import { Injectable, Inject } from '@nestjs/common';
import { Pool } from 'pg';

@Injectable()
export class JobsService {
  constructor(@Inject('PG_POOL') private pool: Pool) {}

  async findAll(status?: string) {
    if (status) {
      const { rows } = await this.pool.query(
        'SELECT * FROM jobs WHERE status = $1 ORDER BY created_at DESC',
        [status],
      );
      return rows;
    }
    const { rows } = await this.pool.query('SELECT * FROM jobs ORDER BY created_at DESC');
    return rows;
  }

  async findById(id: string) {
    const { rows } = await this.pool.query('SELECT * FROM jobs WHERE id = $1', [id]);
    return rows[0];
  }
}
