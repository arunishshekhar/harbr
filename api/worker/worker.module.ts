import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { JobsProcessor } from './processors/jobs.processor';
import { WorkerBootstrap } from './processors/jobs.processor';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    BullModule.forRootAsync({
      useFactory: () => ({
        connection: {
          host: process.env.REDIS_HOST || 'localhost',
          port: parseInt(process.env.REDIS_PORT || '6379'),
        },
      }),
    }),
    BullModule.registerQueue({ name: 'harbr-jobs' }),
  ],
  providers: [JobsProcessor, WorkerBootstrap],
})
export class WorkerModule {}
