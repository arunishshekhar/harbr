import { Controller, Get, Patch, Body, Inject } from '@nestjs/common';
import { Pool } from 'pg';
import { CleanupService } from './cleanup.service';

@Controller('system')
export class SystemController {
  constructor(
    @Inject('PG_POOL') private pool: Pool,
    private cleanup: CleanupService,
  ) {}

  @Get('health')
  health() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  @Get('settings')
  async getSettings() {
    const { rows } = await this.pool.query(
      'SELECT key, value FROM system_settings',
    );
    const settings: Record<string, any> = {};
    for (const row of rows) {
      try { settings[row.key] = JSON.parse(row.value); }
      catch { settings[row.key] = row.value; }
    }
    return settings;
  }

  @Patch('settings')
  async updateSettings(@Body() body: Record<string, any>) {
    const ALLOWED = new Set([
      'access_mode', 'domain', 'cf_dns_token', 'cf_tunnel_token',
      'smtp_host', 'smtp_port', 'smtp_user', 'smtp_pass',
      'telegram_bot_token', 'telegram_chat_id',
      'registry_ip', 'tailscale_auth_key',
    ]);

    for (const [key, value] of Object.entries(body)) {
      if (!ALLOWED.has(key)) continue;
      await this.pool.query(
        `INSERT INTO system_settings (key, value, updated_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
        [key, JSON.stringify(value)],
      );
    }

    return this.getSettings();
  }
}
