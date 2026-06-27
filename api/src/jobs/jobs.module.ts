import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { JobsController } from './jobs.controller';
import { JobsService } from './jobs.service';
import { JobsProcessor } from './jobs.processor';
import { BuildsModule } from '../builds/builds.module';
import { DeploymentsModule } from '../deployments/deployments.module';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'harbr-jobs' }),
    BuildsModule,
    DeploymentsModule,
  ],
  controllers: [JobsController],
  providers: [JobsService, JobsProcessor],
  exports: [JobsService],
})
export class JobsModule {}
