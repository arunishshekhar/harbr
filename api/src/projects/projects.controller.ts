import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ProjectsService } from './projects.service';

@Controller('projects')
@UseGuards(AuthGuard('jwt'))
export class ProjectsController {
  constructor(private projects: ProjectsService) {}

  @Get()
  async findAll() { return this.projects.findAll(); }

  @Get(':id')
  async findById(@Param('id') id: string) { return this.projects.findById(id); }

  @Post()
  async create(@Body() body: any) { return this.projects.create(body); }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: any) { return this.projects.update(id, body); }

  @Delete(':id')
  async delete(@Param('id') id: string) { await this.projects.delete(id); return { deleted: true }; }
}
