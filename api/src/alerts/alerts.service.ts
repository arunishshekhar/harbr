import { Injectable, Inject } from '@nestjs/common';
import { Pool } from 'pg';

@Injectable()
export class AlertsService {
  constructor(@Inject('PG_POOL') private pool: Pool) {}

  async findAll() {
    const { rows } = await this.pool.query('SELECT * FROM alert_configs ORDER BY created_at DESC');
    return rows;
  }

  async create(data: any) {
    const { rows } = await this.pool.query(
      `INSERT INTO alert_configs (project_id, node_id, metric, threshold, channels)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [data.project_id, data.node_id, data.metric, data.threshold, JSON.stringify(data.channels || ['email'])],
    );
    return rows[0];
  }

  async sendSystemAlert(title: string, message: string) {
    console.log(`[ALERT] ${title}: ${message}`);
  }
}
