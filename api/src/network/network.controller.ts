import { Controller, Get, Post, Patch, Delete, Body, Param } from '@nestjs/common';
import { NetworkService } from './network.service';
import { ExternalProxyService } from './external-proxy.service';

@Controller('network')
export class NetworkController {
  constructor(
    private network: NetworkService,
    private proxy: ExternalProxyService,
  ) {}

  // Validate a proxy target without saving (used by UI pre-flight)
  @Post('validate-target')
  async validateTarget(@Body() body: { address: string; port: number }) {
    await this.proxy.validateProxyTarget(body.address, body.port);
    return { allowed: true };
  }

  // ─── Proxy rules ─────────────────────────────────────────────────────────────

  @Get('proxies')
  listProxies() {
    return this.network.listProxies();
  }

  @Post('proxies')
  createProxy(@Body() body: {
    name: string;
    project_id: string;
    target_address: string;
    target_port: number;
    path_prefix: string;
  }) {
    return this.network.createProxy(body);
  }

  @Patch('proxies/:id')
  updateProxy(
    @Param('id') id: string,
    @Body() body: { enabled?: boolean; target_address?: string; target_port?: number },
  ) {
    return this.network.updateProxy(id, body);
  }

  @Delete('proxies/:id')
  deleteProxy(@Param('id') id: string) {
    return this.network.deleteProxy(id);
  }

  // ─── Cilium policies ─────────────────────────────────────────────────────────

  @Get('policies')
  listPolicies() {
    return this.network.listPolicies();
  }
}
