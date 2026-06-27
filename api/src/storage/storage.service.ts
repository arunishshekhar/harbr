import { Injectable } from '@nestjs/common';
import { KubeConfig, CustomObjectsApi } from '@kubernetes/client-node';

@Injectable()
export class StorageService {
  private customApi: CustomObjectsApi;

  constructor() {
    const kc = new KubeConfig();
    try {
      process.env.KUBERNETES_SERVICE_HOST
        ? kc.loadFromCluster()
        : kc.loadFromDefault();
      this.customApi = kc.makeApiClient(CustomObjectsApi);
    } catch {
      // Not in a k8s environment — no-op
    }
  }

  async getStatus() {
    return { provider: 'longhorn', status: 'healthy' };
  }

  async getVolumes(): Promise<any[]> {
    if (!this.customApi) return [];
    try {
      const res = await this.customApi.listClusterCustomObject({
        group: 'longhorn.io',
        version: 'v1beta2',
        plural: 'volumes',
      });
      const items = (res as any).items ?? [];
      return items.map((v: any) => ({
        name: v.metadata?.name,
        size: v.spec?.size,
        state: v.status?.state,
        replicas: v.spec?.numberOfReplicas,
        node: v.status?.currentNodeID,
        created_at: v.metadata?.creationTimestamp,
      }));
    } catch {
      return [];
    }
  }
}
