import { Module } from '@nestjs/common';
import { ExternalProxyService } from './external-proxy.service';
import { NetworkController } from './network.controller';

@Module({
  controllers: [NetworkController],
  providers: [ExternalProxyService],
  exports: [ExternalProxyService],
})
export class NetworkModule {}
