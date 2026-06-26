import { Module } from '@nestjs/common';
import { CleanupService } from './cleanup.service';
import { SystemController } from './system.controller';

@Module({
  controllers: [SystemController],
  providers: [CleanupService],
})
export class SystemModule {}
