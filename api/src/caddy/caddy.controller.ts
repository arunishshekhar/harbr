import { Controller, Get, Post, Delete, Body, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CaddyService } from './caddy.service';

@Controller('caddy')
@UseGuards(AuthGuard('jwt'))
export class CaddyController {
  constructor(private caddy: CaddyService) {}

  @Get('config')
  async getConfig() { return this.caddy.getConfig(); }

  @Post('routes')
  async addRoute(@Body() body: { domain: string; upstream: string }) {
    return this.caddy.addRoute(body.domain, body.upstream);
  }

  @Delete('routes')
  async removeRoute(@Body() body: { domain: string }) {
    return this.caddy.removeRoute(body.domain);
  }
}
