import { Injectable, Inject, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { Pool } from 'pg';
import * as crypto from 'crypto';

@Injectable()
export class WebhooksService {
  constructor(@Inject('PG_POOL') private pool: Pool) {}

  async findByPath(endpointPath: string) {
    const { rows } = await this.pool.query(
      'SELECT * FROM webhooks WHERE endpoint_path = $1',
      [endpointPath],
    );
    return rows[0];
  }

  async isDeliveryProcessed(deliveryId: string, webhookId: string): Promise<boolean> {
    const { rows } = await this.pool.query(
      'SELECT 1 FROM webhook_deliveries WHERE delivery_id = $1 AND webhook_id = $2',
      [deliveryId, webhookId],
    );
    return rows.length > 0;
  }

  async recordDelivery(deliveryId: string, webhookId: string): Promise<void> {
    await this.pool.query(
      'INSERT INTO webhook_deliveries (delivery_id, webhook_id) VALUES ($1, $2) ON CONFLICT (delivery_id) DO NOTHING',
      [deliveryId, webhookId],
    );
  }

  async verifyGitHubSignature(rawBody: Buffer, signature: string, secretHash: string): Promise<void> {
    if (!signature && !secretHash) return;
    const sig = crypto.createHmac('sha256', secretHash).update(rawBody).digest('hex');
    if (`sha256=${sig}` !== signature) {
      throw new UnauthorizedException('Invalid signature');
    }
  }

  async updateLastTriggered(webhookId: string, status: string): Promise<void> {
    await this.pool.query(
      "UPDATE webhooks SET last_triggered_at = NOW(), last_trigger_status = $1 WHERE id = $2",
      [status, webhookId],
    );
  }

  async create(data: any) {
    const { rows } = await this.pool.query(
      `INSERT INTO webhooks (project_id, endpoint_path, secret_hash, git_url, branch_rules)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [data.project_id, data.endpoint_path, data.secret_hash, data.git_url, JSON.stringify(data.branch_rules || {})],
    );
    return rows[0];
  }

  async findByProject(projectId: string) {
    const { rows } = await this.pool.query('SELECT * FROM webhooks WHERE project_id = $1', [projectId]);
    return rows;
  }
}
