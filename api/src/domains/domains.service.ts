import { Injectable, Inject } from '@nestjs/common';
import { Pool } from 'pg';

@Injectable()
export class DomainsService {
  constructor(@Inject('PG_POOL') private pool: Pool) {}

  async findAll() {
    const { rows } = await this.pool.query('SELECT * FROM domains ORDER BY domain');
    return rows;
  }

  async create(data: any) {
    const { rows } = await this.pool.query(
      `INSERT INTO domains (domain, cloudflare_zone_id, ssl_strategy, ddns_enabled)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [data.domain, data.cloudflare_zone_id, data.ssl_strategy || 'cloudflare_edge', data.ddns_enabled || false],
    );
    return rows[0];
  }

  async update(id: string, data: any) {
    const sets: string[] = [];
    const vals: any[] = [];
    let idx = 1;
    for (const [key, val] of Object.entries(data)) {
      sets.push(`${key} = $${idx++}`);
      vals.push(val);
    }
    vals.push(id);
    const { rows } = await this.pool.query(
      `UPDATE domains SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
      vals,
    );
    return rows[0];
  }

  async delete(id: string) {
    await this.pool.query('DELETE FROM domains WHERE id = $1', [id]);
  }
}
