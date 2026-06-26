import { Module, Global } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';

@Global()
@Module({
  providers: [
    {
      provide: 'PG_POOL',
      useFactory: (config: ConfigService) => new Pool({
        host: config.get('DB_HOST', 'localhost'),
        port: parseInt(config.get('DB_PORT', '5432')),
        user: config.get('DB_USER', 'harbr'),
        password: config.get('DB_PASSWORD', 'harbr'),
        database: config.get('DB_NAME', 'harbr'),
        max: 20,
        idleTimeoutMillis: 30000,
      }),
      inject: [ConfigService],
    },
  ],
  exports: ['PG_POOL'],
})
export class DatabaseModule {}
