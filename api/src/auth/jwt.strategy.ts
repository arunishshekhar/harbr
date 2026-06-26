import { Injectable, Inject, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Pool } from 'pg';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(@Inject('PG_POOL') private pool: Pool) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: process.env.JWT_SECRET || 'harbr-dev-secret-change-in-production',
    });
  }

  async validate(payload: any) {
    const { rows } = await this.pool.query(
      'SELECT 1 FROM jwt_blocklist WHERE jti = $1',
      [payload.jti],
    );
    if (rows.length > 0) {
      throw new UnauthorizedException('Token revoked');
    }
    return { id: payload.sub, username: payload.username, role: payload.role, jti: payload.jti };
  }
}
