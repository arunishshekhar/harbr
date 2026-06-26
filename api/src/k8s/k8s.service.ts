import { Injectable } from '@nestjs/common';
import * as k8s from '@kubernetes/client-node';

@Injectable()
export class K8sService {
  private coreApi: k8s.CoreV1Api;
  private appsApi: k8s.AppsV1Api;
  private batchApi: k8s.BatchV1Api;
  private netApi: k8s.NetworkingV1Api;

  constructor() {
    const kc = new k8s.KubeConfig();
    process.env.KUBERNETES_SERVICE_HOST
      ? kc.loadFromCluster()
      : kc.loadFromDefault();
    this.coreApi = kc.makeApiClient(k8s.CoreV1Api);
    this.appsApi = kc.makeApiClient(k8s.AppsV1Api);
    this.batchApi = kc.makeApiClient(k8s.BatchV1Api);
    this.netApi = kc.makeApiClient(k8s.NetworkingV1Api);
  }

  async applyProject(project: any, imageTag: string): Promise<void> {
    const ns = project.namespace;
    const labels = { app: project.name, 'harbr.io/project': project.id };

    await this.ensureNamespace(ns);
    await this.applyNetworkPolicy(ns);

    const deployment: k8s.V1Deployment = {
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

    const service: k8s.V1Service = {
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

    await this.applyResource('Deployment', project.name, ns, deployment,
      () => this.appsApi.createNamespacedDeployment({ namespace: ns, body: deployment }),
      () => this.appsApi.replaceNamespacedDeployment({ name: project.name, namespace: ns, body: deployment }),
    );

    await this.applyResource('Service', project.name, ns, service,
      () => this.coreApi.createNamespacedService({ namespace: ns, body: service }),
      () => this.coreApi.replaceNamespacedService({ name: project.name, namespace: ns, body: service }),
    );
  }

  getProjectUpstream(project: any): string {
    return `${project.name}.${project.namespace}.svc.cluster.local:80`;
  }

  async deleteProject(project: any): Promise<void> {
    const ns = project.namespace;
    await this.appsApi.deleteNamespacedDeployment({ name: project.name, namespace: ns }).catch(() => {});
    await this.coreApi.deleteNamespacedService({ name: project.name, namespace: ns }).catch(() => {});
    await this.coreApi.deleteNamespace({ name: ns }).catch(() => {});
  }

  async ensureNamespace(ns: string): Promise<void> {
    try {
      await this.coreApi.readNamespace({ name: ns });
    } catch {
      await this.coreApi.createNamespace({
        body: { metadata: { name: ns, labels: { 'harbr.io/managed': 'true' } } },
      });
    }
  }

  async applyNetworkPolicy(ns: string): Promise<void> {
    try {
      await this.netApi.createNamespacedNetworkPolicy({
        namespace: ns,
        body: {
          metadata: { name: 'default-deny' },
          spec: {
            podSelector: {},
            policyTypes: ['Ingress', 'Egress'],
            ingress: [{
              from: [{ namespaceSelector: { matchLabels: { 'harbr.io/managed': 'true' } } }],
            }],
            egress: [{
              to: [{ namespaceSelector: { matchLabels: { 'harbr.io/managed': 'true' } } }],
            }, {
              to: [{ ipBlock: { cidr: '0.0.0.0/0', except: ['10.42.0.0/16', '10.43.0.0/16', '100.64.0.0/10'] } }],
            }],
          },
        },
      }).catch(() => {});
    } catch {}
  }

  async getPVCUsagePct(pvcName: string, ns: string): Promise<number> {
    try {
      const pvc = await this.coreApi.readNamespacedPersistentVolumeClaim({ name: pvcName, namespace: ns });
      const capacity = pvc.spec?.resources?.requests?.storage;
      if (!capacity) return 0;
      return 50;
    } catch {
      return 0;
    }
  }

  private async applyResource(
    kind: string, name: string, namespace: string,
    _body: any, createFn: () => Promise<any>, replaceFn: () => Promise<any>,
  ): Promise<void> {
    try {
      await replaceFn();
    } catch (e: any) {
      if (e.statusCode === 404 || e.response?.statusCode === 404) {
        await createFn();
      } else {
        throw e;
      }
    }
  }
}
