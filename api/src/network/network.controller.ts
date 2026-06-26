import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ExternalProxyService } from './external-proxy.service';

@Controller('network')
@UseGuards(AuthGuard('jwt'))
export class NetworkController {
  constructor(private proxy: ExternalProxyService) {}

  @Post('validate-target')
  async validateTarget(@Body() body: { address: string; port: number }) {
    await this.proxy.validateProxyTarget(body.address, body.port);
    return { allowed: true };
  }
}
