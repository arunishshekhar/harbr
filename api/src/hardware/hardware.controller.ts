import { Controller, Get, Post, Param, Body, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { HardwareService } from './hardware.service';

@Controller('hardware')
@UseGuards(AuthGuard('jwt'))
export class HardwareController {
  constructor(private hardware: HardwareService) {}

  @Get('events')
  async getEvents(@Param('nodeId') nodeId?: string) { return this.hardware.getEvents(nodeId); }

  @Post('events')
  async logEvent(@Body() body: any) { return this.hardware.logEvent(body); }
}
