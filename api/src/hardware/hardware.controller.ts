import { Controller, Get, Post, Query, Body } from '@nestjs/common';
import { HardwareService } from './hardware.service';

@Controller('hardware')
export class HardwareController {
  constructor(private hardware: HardwareService) {}

  /**
   * GET /hardware
   * Returns live hardware snapshots from all online nodes' daemons.
   * This is what the Dashboard calls to power node health cards.
   */
  @Get()
  async getLiveSnapshots() {
    return this.hardware.getLiveSnapshots();
  }

  /**
   * GET /hardware/events?nodeId=xxx
   * Historical device add/remove events from Postgres.
   */
  @Get('events')
  async getEvents(@Query('nodeId') nodeId?: string) {
    return this.hardware.getEvents(nodeId);
  }

  /**
   * POST /hardware/events
   * Called by the daemon to push device events into Postgres.
   */
  @Post('events')
  async logEvent(@Body() body: any) {
    return this.hardware.logEvent(body);
  }
}
