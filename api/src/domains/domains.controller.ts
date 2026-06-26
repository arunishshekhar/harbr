import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { DomainsService } from './domains.service';

@Controller('domains')
@UseGuards(AuthGuard('jwt'))
export class DomainsController {
  constructor(private domains: DomainsService) {}

  @Get()
  async findAll() { return this.domains.findAll(); }

  @Post()
  async create(@Body() body: any) { return this.domains.create(body); }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: any) { return this.domains.update(id, body); }

  @Delete(':id')
  async delete(@Param('id') id: string) { await this.domains.delete(id); return { deleted: true }; }
}
