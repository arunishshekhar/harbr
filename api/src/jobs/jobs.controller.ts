import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { JobsService } from './jobs.service';

@Controller('jobs')
@UseGuards(AuthGuard('jwt'))
export class JobsController {
  constructor(private jobs: JobsService) {}

  @Get()
  async findAll(@Query('status') status?: string) { return this.jobs.findAll(status); }

  @Get(':id')
  async findById(@Param('id') id: string) { return this.jobs.findById(id); }
}
