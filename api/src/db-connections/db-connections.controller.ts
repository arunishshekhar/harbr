import { Controller, Get, Post, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { DbConnectionsService } from './db-connections.service';

@Controller('db-connections')
@UseGuards(AuthGuard('jwt'))
export class DbConnectionsController {
  constructor(private service: DbConnectionsService) {}

  @Get('project/:projectId')
  async findByProject(@Param('projectId') projectId: string) { return this.service.findByProject(projectId); }

  @Post()
  async create(@Body() body: any) { return this.service.create(body); }

  @Delete(':id')
  async delete(@Param('id') id: string) { await this.service.delete(id); return { deleted: true }; }
}
