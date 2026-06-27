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
   * Apply a built image to K3s:
   *   1. Namespace
   *   2. Deployment  (rolling update, probes, resource limits)
   *   3. ClusterIP Service
   *   4. Traefik Ingress  (with TLS if domain is set)
   *
   * Called by JobsProcessor after a successful build job.
   */
  async applyToK3s(payload: {
    projectId: string;
    imageTag: string;
    buildId?: string;
    deploymentId?: string;
  }): Promise<void> {
    const { projectId, imageTag, deploymentId } = payload;

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
    const domain: string | undefined = project.domain;

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

      // Wire traffic routing via Traefik Ingress (K3s default ingress controller)
      if (domain) {
        await this.applyIngress(name, namespace, domain, port);
        this.logger.log(`Ingress created: ${domain} → ${name}:${port}`);
      }

      await this.pool.query(
        `UPDATE projects
         SET project_status = 'running',
             observed_status = 'running',
             current_image_tag = $2
         WHERE id = $1`,
        [projectId, imageTag],
      );

      if (deploymentId) {
        await this.pool.query(
          "UPDATE deployments SET status = 'completed', completed_at = NOW() WHERE id = $1",
          [deploymentId],
        );
      }

      this.logger.log(`✓ Project ${name} deployed → ${domain ?? 'no domain'} (${image})`);
    } catch (err: any) {
      this.logger.error(`✗ Deploy failed for ${name}: ${err.message}`);
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

  /** Legacy alias kept for reconciler compatibility */
  async executeK8sDeploy(payload: any) {
    return this.applyToK3s(payload);
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

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
      } catch { /* already exists race — ignore */ }
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
      name: k, value: String(v),
    }));

    const manifest: any = {
      apiVersion: 'apps/v1',
      kind: 'Deployment',
      metadata: {
        name, namespace,
        labels: { 'harbr.io/project': project.id },
        annotations: { 'harbr.io/deployed-at': new Date().toISOString() },
      },
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
              name, image,
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
                failureThreshold: 3,
              },
              livenessProbe: {
                httpGet: {
                  path: project.healthcheck_path ?? '/health',
                  port: project.healthcheck_port ?? port,
                },
                initialDelaySeconds: (project.healthcheck_initial_delay_secs ?? 10) + 10,
                periodSeconds: 15,
                failureThreshold: 5,
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
        try {
          await this.k8sApi.replace(manifest);
        } catch {
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
      metadata: { name, namespace, labels: { 'harbr.io/managed': 'true' } },
      spec: {
        selector: { app: name },
        ports: [{ name: 'http', port: 80, targetPort: port, protocol: 'TCP' }],
        type: 'ClusterIP',
      },
    };

    try {
      await this.k8sApi.create(manifest);
    } catch (e: any) {
      if (e.body?.code !== 409 && e.statusCode !== 409) throw e;
      // Already exists — replace to pick up any port changes
      try { await this.k8sApi.replace(manifest); } catch { /* ignore */ }
    }
  }

  /**
   * Create/update a Traefik Ingress for the project domain.
   *
   * TLS strategy:
   *  - If CLUSTER_ISSUER env is set (e.g. "letsencrypt-prod"), we annotate
   *    for cert-manager and add a TLS block — cert-manager handles ACME.
   *  - If not set, we still create the Ingress for HTTP routing; TLS can be
   *    added manually or via a wildcard secret named "harbr-tls-wildcard".
   */
  private async applyIngress(
    name: string,
    namespace: string,
    domain: string,
    port: number,
  ): Promise<void> {
    const clusterIssuer = process.env.CLUSTER_ISSUER ?? '';
    const wildcardSecret = process.env.TLS_WILDCARD_SECRET ?? 'harbr-tls-wildcard';

    const annotations: Record<string, string> = {
      'harbr.io/managed': 'true',
    };
    if (clusterIssuer) {
      annotations['cert-manager.io/cluster-issuer'] = clusterIssuer;
    }

    const ingressTLS = clusterIssuer
      ? [{ hosts: [domain], secretName: `${name}-tls` }]
      : process.env.TLS_WILDCARD_SECRET
        ? [{ hosts: [domain], secretName: wildcardSecret }]
        : undefined;

    const manifest: any = {
      apiVersion: 'networking.k8s.io/v1',
      kind: 'Ingress',
      metadata: { name, namespace, annotations },
      spec: {
        ingressClassName: process.env.INGRESS_CLASS ?? 'traefik',
        rules: [{
          host: domain,
          http: {
            paths: [{
              path: '/',
              pathType: 'Prefix',
              backend: {
                service: {
                  name,
                  port: { number: 80 },
                },
              },
            }],
          },
        }],
        ...(ingressTLS ? { tls: ingressTLS } : {}),
      },
    };

    try {
      await this.k8sApi.create(manifest);
    } catch (e: any) {
      if (e.body?.code === 409 || e.statusCode === 409) {
        try { await this.k8sApi.replace(manifest); } catch { /* ignore */ }
      } else {
        // Ingress failure is non-fatal — pod is already running, log and continue
        this.logger.error(`Ingress apply failed for ${domain}: ${e.message}`);
      }
    }
  }
}
