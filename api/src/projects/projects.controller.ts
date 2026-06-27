import { Controller, Get, Post, Patch, Delete, Param, Body } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { BuildsService } from '../builds/builds.service';

@Controller('projects')
export class ProjectsController {
  constructor(
    private projects: ProjectsService,
    private builds: BuildsService,
  ) {}

  @Get()
  async findAll() { return this.projects.findAll(); }

  @Get(':id')
  async findById(@Param('id') id: string) { return this.projects.findById(id); }

  @Post()
  async create(@Body() body: any) { return this.projects.create(body); }

  @Post(':id/deploy')
  async triggerDeploy(@Param('id') id: string, @Body() body: any) {
    return this.builds.triggerBuild(id, 'manual', body.user_id);
  }

  @Post(':id/rollback')
  async rollback(@Param('id') id: string, @Body() body: any) {
    return this.builds.triggerBuild(id, 'rollback', body.user_id);
  }

  @Get(':id/builds')
  async getBuilds(@Param('id') id: string) { return this.builds.findAll(id); }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: any) { return this.projects.update(id, body); }

  @Delete(':id')
  async delete(@Param('id') id: string) { await this.projects.delete(id); return { deleted: true }; }
}
