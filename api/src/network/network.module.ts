import { Module } from '@nestjs/common';
import { ExternalProxyService } from './external-proxy.service';
import { NetworkController } from './network.controller';
import { NetworkService } from './network.service';

@Module({
  controllers: [NetworkController],
  providers: [ExternalProxyService, NetworkService],
  exports: [ExternalProxyService, NetworkService],
})
export class NetworkModule {}
