import { Injectable, Inject, ConflictException } from '@nestjs/common';
import { Pool } from 'pg';

@Injectable()
export class ProjectsService {
  constructor(@Inject('PG_POOL') private pool: Pool) {}

  async findAll() {
    const { rows } = await this.pool.query(
      'SELECT * FROM projects ORDER BY created_at DESC',
    );
    return rows;
  }

  async findById(id: string) {
    const { rows } = await this.pool.query('SELECT * FROM projects WHERE id = $1', [id]);
    return rows[0];
  }

  async findByNamespace(namespace: string) {
    const { rows } = await this.pool.query('SELECT * FROM projects WHERE namespace = $1', [namespace]);
    return rows[0];
  }

  async create(data: any) {
    const { rows } = await this.pool.query(
      `INSERT INTO projects (name, namespace, git_url, git_branch, docker_image, dockerfile_path,
        port, domain, cpu_request, cpu_limit, memory_request, memory_limit, gpu_enabled,
        storage_size, storage_replicas, env_vars, healthcheck_path, healthcheck_port,
        healthcheck_initial_delay_secs, runtime_version, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
       RETURNING *`,
      [data.name, data.namespace, data.git_url, data.git_branch || 'main',
       data.docker_image, data.dockerfile_path || 'Dockerfile', data.port, data.domain,
       data.cpu_request || '0.25', data.cpu_limit || '2.0',
       data.memory_request || '128Mi', data.memory_limit || '1Gi',
       data.gpu_enabled || false, data.storage_size || '5Gi',
       data.storage_replicas || 1, JSON.stringify(data.env_vars || {}),
       data.healthcheck_path || '/health', data.healthcheck_port || data.port,
       data.healthcheck_initial_delay_secs || 10, data.runtime_version, data.created_by],
    );
    return rows[0];
  }

  async update(id: string, data: any) {
    const sets: string[] = [];
    const vals: any[] = [];
    let idx = 1;
    for (const [key, val] of Object.entries(data)) {
      if (key === 'env_vars') {
        sets.push(`env_vars = $${idx++}::jsonb`);
        vals.push(JSON.stringify(val));
      } else {
        sets.push(`${key} = $${idx++}`);
        vals.push(val);
      }
    }
    vals.push(id);
    sets.push('updated_at = NOW()');
    const { rows } = await this.pool.query(
      `UPDATE projects SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
      vals,
    );
    return rows[0];
  }

  async delete(id: string) {
    await this.pool.query('DELETE FROM projects WHERE id = $1', [id]);
  }
}
