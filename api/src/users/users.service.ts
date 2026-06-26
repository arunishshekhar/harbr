import { Injectable, Inject } from '@nestjs/common';
import { Pool } from 'pg';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(@Inject('PG_POOL') private pool: Pool) {}

  async findAll() {
    const { rows } = await this.pool.query(
      'SELECT id, username, email, role, is_active, last_login_at, created_at FROM users ORDER BY created_at DESC',
    );
    return rows;
  }

  async findById(id: string) {
    const { rows } = await this.pool.query(
      'SELECT id, username, email, role, is_active, last_login_at, created_at FROM users WHERE id = $1',
      [id],
    );
    return rows[0];
  }

  async create(data: { username: string; email?: string; password: string; role?: string }) {
    const hash = await bcrypt.hash(data.password, 12);
    const { rows } = await this.pool.query(
      `INSERT INTO users (username, email, password_hash, role)
       VALUES ($1, $2, $3, $4) RETURNING id, username, email, role, created_at`,
      [data.username, data.email || null, hash, data.role || 'viewer'],
    );
    return rows[0];
  }

  async update(id: string, data: Partial<{ username: string; email: string; role: string; is_active: boolean }>) {
    const sets: string[] = [];
    const vals: any[] = [];
    let idx = 1;
    for (const [key, val] of Object.entries(data)) {
      sets.push(`${key} = $${idx++}`);
      vals.push(val);
    }
    vals.push(id);
    const { rows } = await this.pool.query(
      `UPDATE users SET ${sets.join(', ')} WHERE id = $${idx} RETURNING id, username, email, role, is_active`,
      vals,
    );
    return rows[0];
  }
}
