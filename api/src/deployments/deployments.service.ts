import { Injectable, Inject, Logger } from '@nestjs/common';
import { Pool } from 'pg';
import { KubeConfig, KubernetesObjectApi, CoreV1Api } from '@kubernetes/client-node';

@Injectable()
export class DeploymentsService {
  private readonly logger = new Logger(DeploymentsService.name);
  private k8sApi: KubernetesObjectApi;
  private coreApi: CoreV1Api;

  constructor(@Inject('PG_POOL') private pool: Pool) {
    const kc = new KubeConfig();
    process.env.KUBERNETES_SERVICE_HOST
      ? kc.loadFromCluster()
      : kc.loadFromDefault();
    this.k8sApi = KubernetesObjectApi.makeApiClient(kc);
    this.coreApi = kc.makeApiClient(CoreV1Api);
  }

  async findAll(projectId?: string) {
    if (projectId) {
      const { rows } = await this.pool.query(
        'SELECT * FROM deployments WHERE project_id = $1 ORDER BY created_at DESC',
        [projectId],
      );
      return rows;
    }
    const { rows } = await this.pool.query('SELECT * FROM deployments ORDER BY created_at DESC');
    return rows;
  }

  async findById(id: string) {
    const { rows } = await this.pool.query('SELECT * FROM deployments WHERE id = $1', [id]);
    return rows[0];
  }

  async createDeployment(
    projectId: string,
    buildId: string,
    imageTag: string,
    triggeredBy = 'manual',
    userId?: string,
  ) {
    const { rows: [deployment] } = await this.pool.query(
      `INSERT INTO deployments (project_id, build_id, image_tag, triggered_by, triggered_by_user)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [projectId, buildId, imageTag, triggeredBy, userId ?? null],
    );
    return deployment;
  }

  /**
   * Apply a built image to K3s — creates/updates Namespace, Deployment, Service.
   * Called by the jobs processor after a successful build.
   */
  async applyToK3s(payload: {
    projectId: string;
    imageTag: string;
    buildId?: string;
    deploymentId?: string;
  }): Promise<void> {
    const { projectId, imageTag, buildId, deploymentId } = payload;

    const { rows: [project] } = await this.pool.query(
      'SELECT * FROM projects WHERE id = $1',
      [projectId],
    );
    if (!project) throw new Error(`Project ${projectId} not found`);

    const reg = `${process.env.REGISTRY_IP ?? 'localhost'}:30500`;
    const image = `${reg}/${projectId}:${imageTag}`;
    const namespace = project.namespace;
    const name = project.name;
    const port = project.port ?? 3000;

    if (deploymentId) {
      await this.pool.query(
        "UPDATE deployments SET status = 'running', started_at = NOW() WHERE id = $1",
        [deploymentId],
      );
    }

    await this.pool.query(
      "UPDATE projects SET project_status = 'deploying', desired_status = 'running' WHERE id = $1",
      [projectId],
    );

    try {
      await this.ensureNamespace(namespace);
      await this.applyDeployment(name, namespace, image, port, project);
      await this.applyService(name, namespace, port);

      await this.pool.query(
        "UPDATE projects SET project_status = 'running', observed_status = 'running', current_image_tag = $2 WHERE id = $1",
        [projectId, imageTag],
      );

      if (deploymentId) {
        await this.pool.query(
          "UPDATE deployments SET status = 'completed', completed_at = NOW() WHERE id = $1",
          [deploymentId],
        );
      }

      this.logger.log(`Project ${name} deployed to namespace ${namespace} with image ${image}`);
    } catch (err: any) {
      await this.pool.query(
        "UPDATE projects SET project_status = 'failed', observed_status = 'failed' WHERE id = $1",
        [projectId],
      );
      if (deploymentId) {
        await this.pool.query(
          "UPDATE deployments SET status = 'failed', completed_at = NOW() WHERE id = $1",
          [deploymentId],
        );
      }
      throw err;
    }
  }

  /**
   * Used by the reconciler/processor's legacy path.
   */
  async executeK8sDeploy(payload: any) {
    return this.applyToK3s(payload);
  }

  private async ensureNamespace(ns: string): Promise<void> {
    try {
      await this.coreApi.readNamespace({ name: ns });
    } catch {
      try {
        await this.coreApi.createNamespace({
          body: {
            apiVersion: 'v1',
            kind: 'Namespace',
            metadata: { name: ns, labels: { 'harbr.io/managed': 'true' } },
          },
        });
      } catch {}
    }
  }

  private async applyDeployment(
    name: string,
    namespace: string,
    image: string,
    port: number,
    project: any,
  ): Promise<void> {
    const envVars = Object.entries(project.env_vars ?? {}).map(([k, v]) => ({
      name: k,
      value: String(v),
    }));

    const manifest: any = {
      apiVersion: 'apps/v1',
      kind: 'Deployment',
      metadata: { name, namespace, labels: { 'harbr.io/project': project.id } },
      spec: {
        replicas: project.replicas ?? 1,
        selector: { matchLabels: { app: name } },
        strategy: {
          type: 'RollingUpdate',
          rollingUpdate: { maxUnavailable: 0, maxSurge: 1 },
        },
        template: {
          metadata: { labels: { app: name, 'harbr.io/project': project.id } },
          spec: {
            containers: [{
              name,
              image,
              imagePullPolicy: 'Always',
              ports: [{ containerPort: port }],
              env: envVars,
              resources: {
                requests: {
                  cpu: project.cpu_request ?? '0.1',
                  memory: project.memory_request ?? '128Mi',
                },
                limits: {
                  cpu: project.cpu_limit ?? '2.0',
                  memory: project.memory_limit ?? '1Gi',
                },
              },
              readinessProbe: {
                httpGet: {
                  path: project.healthcheck_path ?? '/health',
                  port: project.healthcheck_port ?? port,
                },
                initialDelaySeconds: project.healthcheck_initial_delay_secs ?? 10,
                periodSeconds: 5,
              },
              livenessProbe: {
                httpGet: {
                  path: project.healthcheck_path ?? '/health',
                  port: project.healthcheck_port ?? port,
                },
                initialDelaySeconds: (project.healthcheck_initial_delay_secs ?? 10) + 10,
                periodSeconds: 15,
              },
            }],
            imagePullSecrets: [{ name: 'registry-credentials' }],
          },
        },
      },
    };

    try {
      await this.k8sApi.create(manifest);
    } catch (e: any) {
      if (e.body?.code === 409 || e.statusCode === 409) {
        // Patch image on existing deployment by replacing with updated manifest
        try {
          await this.k8sApi.replace(manifest);
        } catch {
          // If replace also fails, log and let the reconciler handle drift
          this.logger.warn(`Deployment ${name} replace failed — reconciler will correct`);
        }
      } else {
        throw e;
      }
    }
  }

  private async applyService(name: string, namespace: string, port: number): Promise<void> {
    const manifest: any = {
      apiVersion: 'v1',
      kind: 'Service',
      metadata: { name, namespace },
      spec: {
        selector: { app: name },
        ports: [{ port: 80, targetPort: port, protocol: 'TCP' }],
        type: 'ClusterIP',
      },
    };

    try {
      await this.k8sApi.create(manifest);
    } catch (e: any) {
      if (e.body?.code !== 409 && e.statusCode !== 409) throw e;
    }
  }
}
