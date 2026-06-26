import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { DeploymentsController } from './deployments.controller';
import { DeploymentsService } from './deployments.service';

@Module({
  imports: [BullModule.registerQueue({ name: 'harbr-jobs' })],
  controllers: [DeploymentsController],
  providers: [DeploymentsService],
  exports: [DeploymentsService],
})
export class DeploymentsModule {}
