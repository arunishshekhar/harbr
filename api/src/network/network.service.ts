import { Injectable, Inject } from '@nestjs/common';
import { Pool } from 'pg';
import { KubeConfig, CustomObjectsApi } from '@kubernetes/client-node';
import { ExternalProxyService } from './external-proxy.service';

@Injectable()
export class NetworkService {
  private kc: KubeConfig;
  private k8sCustom: CustomObjectsApi;

  constructor(
    @Inject('PG_POOL') private pool: Pool,
    private externalProxy: ExternalProxyService,
  ) {
    this.kc = new KubeConfig();
    process.env.KUBERNETES_SERVICE_HOST
      ? this.kc.loadFromCluster()
      : this.kc.loadFromDefault();
    this.k8sCustom = this.kc.makeApiClient(CustomObjectsApi);
  }

  // ─── Proxy CRUD ──────────────────────────────────────────────────────────────

  async createProxy(data: {
    name: string;
    project_id: string;
    target_address: string;
    target_port: number;
    path_prefix: string;
  }) {
    await this.externalProxy.validateProxyTarget(data.target_address, data.target_port);
    const { rows } = await this.pool.query(
      `INSERT INTO external_proxies (name, project_id, target_address, target_port, path_prefix, enabled)
       VALUES ($1, $2, $3, $4, $5, true) RETURNING *`,
      [data.name, data.project_id, data.target_address, data.target_port, data.path_prefix],
    );
    return rows[0];
  }

  async listProxies() {
    const { rows } = await this.pool.query(`
      SELECT ep.*, p.name as project_name
      FROM external_proxies ep
      LEFT JOIN projects p ON p.id = ep.project_id
      ORDER BY ep.created_at DESC
    `);
    return rows;
  }

  async updateProxy(id: string, data: { enabled?: boolean; target_address?: string; target_port?: number }) {
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (data.enabled !== undefined) {
      fields.push(`enabled = $${idx++}`);
      values.push(data.enabled);
    }
    if (data.target_address !== undefined) {
      await this.externalProxy.validateProxyTarget(data.target_address, data.target_port || 80);
      fields.push(`target_address = $${idx++}`);
      values.push(data.target_address);
    }
    if (data.target_port !== undefined) {
      fields.push(`target_port = $${idx++}`);
      values.push(data.target_port);
    }

    if (fields.length === 0) return;

    values.push(id);
    const { rows } = await this.pool.query(
      `UPDATE external_proxies SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $${idx} RETURNING *`,
      values,
    );
    return rows[0];
  }

  async deleteProxy(id: string) {
    await this.pool.query('DELETE FROM external_proxies WHERE id = $1', [id]);
  }

  // ─── Cilium Policies ─────────────────────────────────────────────────────────

  async listPolicies(): Promise<any[]> {
    try {
      const result: any = await this.k8sCustom.listClusterCustomObject({
        group: 'cilium.io',
        version: 'v2',
        plural: 'ciliumnetworkpolicies',
      });
      const items: any[] = result?.items || [];
      return items.map(item => ({
        namespace: item.metadata?.namespace,
        project_name: item.metadata?.namespace?.replace('harbr-proj-', '') ?? '',
        policy_name: item.metadata?.name,
        default_deny: item.spec?.endpointSelector !== undefined &&
          Object.keys(item.spec?.endpointSelector || {}).length === 0,
      }));
    } catch {
      // Cilium not installed or CRD unavailable — return empty list gracefully
      return [];
    }
  }
}
