import { Injectable } from '@nestjs/common';
import { KubeConfig, KubernetesObjectApi } from '@kubernetes/client-node';

@Injectable()
export class K8sService {
  private kc: KubeConfig;
  private k8sApi: KubernetesObjectApi;

  constructor() {
    this.kc = new KubeConfig();
    process.env.KUBERNETES_SERVICE_HOST
      ? this.kc.loadFromCluster()
      : this.kc.loadFromDefault();
    this.k8sApi = KubernetesObjectApi.makeApiClient(this.kc);
  }

  async applyProject(project: any, imageTag: string): Promise<void> {
    const ns = project.namespace;

    await this.ensureNamespace(ns);

    const labels = { app: project.name, 'harbr.io/project': project.id };

    const deployment = {
      apiVersion: 'apps/v1',
      kind: 'Deployment',
      metadata: { name: project.name, namespace: ns, labels },
      spec: {
        replicas: 1,
        selector: { matchLabels: { app: project.name } },
        template: {
          metadata: { labels: { app: project.name } },
          spec: {
            containers: [{
              name: project.name,
              image: `${process.env.REGISTRY_IP}:30500/${project.name}:${imageTag}`,
              ports: [{ containerPort: project.port }],
              resources: {
                requests: { cpu: project.cpu_request, memory: project.memory_request },
                limits: { cpu: project.cpu_limit, memory: project.memory_limit },
              },
              env: Object.entries(project.env_vars || {}).map(([name, value]) => ({ name, value: String(value) })),
              readinessProbe: {
                httpGet: {
                  path: project.healthcheck_path || '/health',
                  port: project.healthcheck_port || project.port,
                },
                initialDelaySeconds: project.healthcheck_initial_delay_secs || 10,
                periodSeconds: 10,
                failureThreshold: 3,
              },
              livenessProbe: {
                tcpSocket: { port: project.healthcheck_port || project.port },
                initialDelaySeconds: 20,
                periodSeconds: 30,
              },
            }],
            imagePullSecrets: [{ name: 'registry-credentials' }],
          },
        },
        strategy: {
          type: 'RollingUpdate',
          rollingUpdate: { maxUnavailable: 0, maxSurge: 1 },
        },
      },
    };

    const service = {
      apiVersion: 'v1',
      kind: 'Service',
      metadata: { name: project.name, namespace: ns, labels },
      spec: {
        selector: { app: project.name },
        ports: [{
          protocol: 'TCP',
          port: 80,
          targetPort: project.port,
        }],
        type: 'ClusterIP',
      },
    };

    await this.replaceOrCreate(deployment);
    await this.replaceOrCreate(service);
  }

  getProjectUpstream(project: any): string {
    return `${project.name}.${project.namespace}.svc.cluster.local:80`;
  }

  async deleteProject(project: any): Promise<void> {
    const ns = project.namespace;
    await this.deleteResource('apps/v1', 'Deployment', project.name, ns).catch(() => {});
    await this.deleteResource('v1', 'Service', project.name, ns).catch(() => {});
    await this.deleteResource('v1', 'Namespace', ns).catch(() => {});
  }

  async ensureNamespace(ns: string): Promise<void> {
    try {
      await this.readResource('v1', 'Namespace', ns);
    } catch {
      try {
        await this.k8sApi.create({
          apiVersion: 'v1',
          kind: 'Namespace',
          metadata: { name: ns, labels: { 'harbr.io/managed': 'true' } },
        });
      } catch {}
    }
  }

  async getPVCUsagePct(_pvcName: string, _ns: string): Promise<number> {
    return 50;
  }

  private async replaceOrCreate(spec: any): Promise<void> {
    try {
      await this.k8sApi.replace(spec);
    } catch {
      await this.k8sApi.create(spec).catch(() => {});
    }
  }

  private async readResource(apiVersion: string, kind: string, name: string, namespace?: string): Promise<any> {
    return this.k8sApi.read({ apiVersion, kind, metadata: { name, namespace } });
  }

  private async deleteResource(apiVersion: string, kind: string, name: string, namespace?: string): Promise<void> {
    await this.k8sApi.delete({ apiVersion, kind, metadata: { name, namespace } });
  }
}
