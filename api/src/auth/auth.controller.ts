import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() body: { username: string; password: string }) {
    return this.auth.login(body.username, body.password);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Body() body: { jti: string; user_id: string; expires_at: string }) {
    await this.auth.logout(body.jti, body.user_id, new Date(body.expires_at));
    return { message: 'Logged out' };
  }

  @Post('revoke-all')
  @HttpCode(HttpStatus.OK)
  async revokeAll(@Body() body: { user_id: string }) {
    await this.auth.revokeAllSessions(body.user_id);
    return { message: 'All sessions revoked' };
  }
}
