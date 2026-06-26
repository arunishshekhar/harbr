import { Module } from '@nestjs/common';
import { CaddyController } from './caddy.controller';
import { CaddyService } from './caddy.service';

@Module({
  controllers: [CaddyController],
  providers: [CaddyService],
  exports: [CaddyService],
})
export class CaddyModule {}
