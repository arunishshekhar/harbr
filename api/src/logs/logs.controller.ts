import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { LogsService } from './logs.service';

@Controller('logs')
@UseGuards(AuthGuard('jwt'))
export class LogsController {
  constructor(private logs: LogsService) {}

  @Get()
  async query(@Query('q') q: string, @Query('start') start?: string, @Query('end') end?: string) {
    return this.logs.query(q, start, end);
  }

  @Get('project')
  async projectLogs(
    @Query('namespace') namespace: string,
    @Query('pod') pod?: string,
    @Query('tail') tail?: string,
  ) {
    return this.logs.projectLogs(namespace, pod, tail ? parseInt(tail) : 100);
  }
}
