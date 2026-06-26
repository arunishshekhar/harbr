import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { BuildsController } from './builds.controller';
import { BuildsService } from './builds.service';
import { KanikoService } from './kaniko.service';

@Module({
  imports: [BullModule.registerQueue({ name: 'harbr-jobs' })],
  controllers: [BuildsController],
  providers: [BuildsService, KanikoService],
  exports: [BuildsService, KanikoService],
})
export class BuildsModule {}
