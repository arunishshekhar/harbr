import { Module } from '@nestjs/common';
import { DbConnectionsController } from './db-connections.controller';
import { DbConnectionsService } from './db-connections.service';

@Module({
  controllers: [DbConnectionsController],
  providers: [DbConnectionsService],
  exports: [DbConnectionsService],
})
export class DbConnectionsModule {}
