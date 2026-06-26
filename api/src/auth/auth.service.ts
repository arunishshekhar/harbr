import { Injectable, UnauthorizedException, Inject } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Pool } from 'pg';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

@Injectable()
export class AuthService {
  constructor(
    private jwt: JwtService,
    @Inject('PG_POOL') private pool: Pool,
  ) {}

  async login(username: string, password: string) {
    const { rows } = await this.pool.query(
      'SELECT id, username, password_hash, role, is_active FROM users WHERE username = $1',
      [username],
    );
    const user = rows[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      throw new UnauthorizedException('Invalid credentials');
    }
    if (!user.is_active) {
      throw new UnauthorizedException('Account is inactive');
    }
    const jti = crypto.randomUUID();
    const payload = { sub: user.id, username: user.username, role: user.role, jti };
    return {
      access_token: this.jwt.sign(payload),
      user: { id: user.id, username: user.username, role: user.role },
    };
  }

  async logout(jti: string, userId: string, expiresAt: Date): Promise<void> {
    await this.pool.query(
      'INSERT INTO jwt_blocklist (jti, user_id, expires_at) VALUES ($1, $2, $3)',
      [jti, userId, expiresAt],
    );
  }

  async revokeAllSessions(userId: string): Promise<void> {
    await this.pool.query(
      'UPDATE users SET token_version = token_version + 1 WHERE id = $1',
      [userId],
    );
  }

  async isJwtRevoked(jti: string): Promise<boolean> {
    const { rows } = await this.pool.query(
      'SELECT 1 FROM jwt_blocklist WHERE jti = $1',
      [jti],
    );
    return rows.length > 0;
  }
}
