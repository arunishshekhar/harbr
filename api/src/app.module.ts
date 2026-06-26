import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { BullModule } from '@nestjs/bullmq';
import { ScheduleModule } from '@nestjs/schedule';
import { DatabaseModule } from './database.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { NodesModule } from './nodes/nodes.module';
import { HardwareModule } from './hardware/hardware.module';
import { ProjectsModule } from './projects/projects.module';
import { BuildsModule } from './builds/builds.module';
import { DeploymentsModule } from './deployments/deployments.module';
import { K8sModule } from './k8s/k8s.module';
import { CaddyModule } from './caddy/caddy.module';
import { DomainsModule } from './domains/domains.module';
import { StorageModule } from './storage/storage.module';
import { TemplatesModule } from './templates/templates.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { AlertsModule } from './alerts/alerts.module';
import { AuditModule } from './audit/audit.module';
import { JobsModule } from './jobs/jobs.module';
import { NetworkModule } from './network/network.module';
import { LogsModule } from './logs/logs.module';
import { DbConnectionsModule } from './db-connections/db-connections.module';
import { SystemModule } from './system/system.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([
      { name: 'short', ttl: 1000, limit: 20 },
      { name: 'long',  ttl: 60000, limit: 200 },
    ]),
    BullModule.forRootAsync({
      useFactory: () => ({
        connection: {
          host: process.env.REDIS_HOST || 'localhost',
          port: 6379,
        },
      }),
    }),
    DatabaseModule,
    AuthModule,
    UsersModule,
    NodesModule,
    HardwareModule,
    ProjectsModule,
    BuildsModule,
    DeploymentsModule,
    K8sModule,
    CaddyModule,
    DomainsModule,
    StorageModule,
    TemplatesModule,
    WebhooksModule,
    AlertsModule,
    AuditModule,
    JobsModule,
    NetworkModule,
    LogsModule,
    DbConnectionsModule,
    SystemModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
