import { Injectable, Inject } from '@nestjs/common';
import { Pool } from 'pg';

@Injectable()
export class AuditService {
  constructor(@Inject('PG_POOL') private pool: Pool) {}

  async findAll(page = 1, limit = 50) {
    const offset = (page - 1) * limit;
    const { rows } = await this.pool.query(
      'SELECT * FROM audit_log ORDER BY created_at DESC LIMIT $1 OFFSET $2',
      [limit, offset],
    );
    const { rows: [{ count }] } = await this.pool.query('SELECT COUNT(*) FROM audit_log');
    return { rows, total: parseInt(count, 10), page, limit };
  }

  async log(entry: {
    actor_id?: string; actor_name?: string; action: string;
    resource_type?: string; resource_id?: string; resource_name?: string;
    changes?: any; job_id?: string; request_id?: string; ip_address?: string;
  }) {
    const { rows } = await this.pool.query(
      `INSERT INTO audit_log (actor_id, actor_name, action, resource_type, resource_id, resource_name, changes, job_id, request_id, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [entry.actor_id, entry.actor_name, entry.action, entry.resource_type,
       entry.resource_id, entry.resource_name,
       entry.changes ? JSON.stringify(entry.changes) : null,
       entry.job_id, entry.request_id, entry.ip_address],
    );
    return rows[0];
  }
}
