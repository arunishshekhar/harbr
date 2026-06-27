import { Controller, Get, Post, Patch, Delete, Param, Body } from '@nestjs/common';
import { NodesService } from './nodes.service';

@Controller('nodes')
export class NodesController {
  constructor(private nodes: NodesService) {}

  @Get()
  async findAll() { return this.nodes.findAll(); }

  @Get(':id')
  async findById(@Param('id') id: string) { return this.nodes.findById(id); }

  @Post()
  async create(@Body() body: any) { return this.nodes.create(body); }

  @Post('join-token')
  async generateJoinToken() { return this.nodes.generateJoinToken(); }

  @Post('consume-token')
  async consumeToken(@Body() body: { token: string }) {
    const valid = await this.nodes.consumeJoinToken(body.token);
    return { valid };
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: any) { return this.nodes.update(id, body); }

  @Delete(':id')
  async delete(@Param('id') id: string) { await this.nodes.delete(id); return { deleted: true }; }
}
