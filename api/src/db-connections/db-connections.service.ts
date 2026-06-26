import { Injectable, Inject } from '@nestjs/common';
import { Pool } from 'pg';

@Injectable()
export class DbConnectionsService {
  constructor(@Inject('PG_POOL') private pool: Pool) {}

  async findByProject(projectId: string) {
    const { rows } = await this.pool.query(
      'SELECT * FROM db_connections WHERE project_id = $1',
      [projectId],
    );
    return rows;
  }

  async create(data: any) {
    const { rows } = await this.pool.query(
      `INSERT INTO db_connections (project_id, db_type, service_name, service_port, database_name, username, k8s_secret_name)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [data.project_id, data.db_type, data.service_name, data.service_port,
       data.database_name, data.username, data.k8s_secret_name],
    );
    return rows[0];
  }

  async delete(id: string) {
    await this.pool.query('DELETE FROM db_connections WHERE id = $1', [id]);
  }

  getConnectionString(conn: any): string {
    switch (conn.db_type) {
      case 'postgres':
        return `postgresql://${conn.username}:****@${conn.service_name}:${conn.service_port}/${conn.database_name}`;
      case 'mysql':
        return `mysql://${conn.username}:****@${conn.service_name}:${conn.service_port}/${conn.database_name}`;
      case 'redis':
        return `redis://${conn.service_name}:${conn.service_port}`;
      default:
        return `${conn.db_type}://${conn.service_name}:${conn.service_port}`;
    }
  }
}
