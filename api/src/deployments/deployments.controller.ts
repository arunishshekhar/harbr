import { Controller, Get, Post, Param, Query, Body, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { DeploymentsService } from './deployments.service';

@Controller('deployments')
@UseGuards(AuthGuard('jwt'))
export class DeploymentsController {
  constructor(private deployments: DeploymentsService) {}

  @Get()
  async findAll(@Query('projectId') projectId?: string) { return this.deployments.findAll(projectId); }

  @Get(':id')
  async findById(@Param('id') id: string) { return this.deployments.findById(id); }
}
