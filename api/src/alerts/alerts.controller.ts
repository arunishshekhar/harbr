import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AlertsService } from './alerts.service';

@Controller('alerts')
@UseGuards(AuthGuard('jwt'))
export class AlertsController {
  constructor(private alerts: AlertsService) {}

  @Get()
  async findAll() { return this.alerts.findAll(); }

  @Post()
  async create(@Body() body: any) { return this.alerts.create(body); }
}
