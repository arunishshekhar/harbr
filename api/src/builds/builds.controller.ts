import { Controller, Get, Post, Param, Query, Body, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { BuildsService } from './builds.service';

@Controller('builds')
@UseGuards(AuthGuard('jwt'))
export class BuildsController {
  constructor(private builds: BuildsService) {}

  @Get()
  async findAll(@Query('projectId') projectId?: string) { return this.builds.findAll(projectId); }

  @Get(':id')
  async findById(@Param('id') id: string) { return this.builds.findById(id); }

  @Post('trigger')
  async triggerBuild(@Body() body: { project_id: string }) {
    return this.builds.triggerBuild(body.project_id);
  }
}
