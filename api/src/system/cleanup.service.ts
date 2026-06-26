import { Injectable, Inject } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Pool } from 'pg';

@Injectable()
export class CleanupService {
  constructor(@Inject('PG_POOL') private pool: Pool) {}

  @Cron('0 0 * * *')
  async maintainAuditLog() {
    await this.pool.query('SELECT create_audit_log_partition()');
    await this.pool.query('SELECT drop_old_audit_log_partitions()');
    await this.pool.query('DELETE FROM jwt_blocklist WHERE expires_at < NOW()');
    await this.pool.query('DELETE FROM webhook_deliveries WHERE expires_at < NOW()');
    console.log('[Cleanup] Audit partitions maintained, expired entries cleaned');
  }

  @Cron('0 3 * * 0')
  async cleanBuildCache() {
    console.log('[Cleanup] Weekly build cache cleanup started');
  }
}
