import { Injectable, Inject } from '@nestjs/common';
import { Pool } from 'pg';

@Injectable()
export class NodesService {
  constructor(@Inject('PG_POOL') private pool: Pool) {}

  async findAll() {
    const { rows } = await this.pool.query('SELECT * FROM nodes ORDER BY joined_at DESC');
    return rows;
  }

  async findById(id: string) {
    const { rows } = await this.pool.query('SELECT * FROM nodes WHERE id = $1', [id]);
    return rows[0];
  }

  async create(data: any) {
    const { rows } = await this.pool.query(
      `INSERT INTO nodes (name, tailscale_ip, public_ip, role, access_mode, cpu_cores, ram_mb, disk_gb, arch, gpu_info, k3s_version, harbr_version, ssh_public_key)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *`,
      [data.name, data.tailscale_ip, data.public_ip, data.role || 'worker',
       data.access_mode || 'tunnel', data.cpu_cores, data.ram_mb, data.disk_gb,
       data.arch || 'amd64', JSON.stringify(data.gpu_info || {}),
       data.k3s_version, data.harbr_version, data.ssh_public_key],
    );
    return rows[0];
  }

  async update(id: string, data: any) {
    const sets: string[] = [];
    const vals: any[] = [];
    let idx = 1;
    for (const [key, val] of Object.entries(data)) {
      if (key === 'gpu_info') {
        sets.push(`gpu_info = $${idx++}::jsonb`);
        vals.push(JSON.stringify(val));
      } else {
        sets.push(`${key} = $${idx++}`);
        vals.push(val);
      }
    }
    vals.push(id);
    const { rows } = await this.pool.query(
      `UPDATE nodes SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
      vals,
    );
    return rows[0];
  }

  async delete(id: string) {
    await this.pool.query('DELETE FROM nodes WHERE id = $1', [id]);
  }
}
