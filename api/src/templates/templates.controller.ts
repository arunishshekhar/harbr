import { Controller, Get, Post, Param, Body } from '@nestjs/common';
import { TemplatesService } from './templates.service';

@Controller('templates')
export class TemplatesController {
  constructor(private templates: TemplatesService) {}

  @Get()
  async findAll() { return this.templates.findAll(); }

  @Get(':name')
  async findByName(@Param('name') name: string) { return this.templates.findByName(name); }

  @Post(':name/deploy')
  async deploy(
    @Param('name') name: string,
    @Body() body: { name: string; domain?: string; nodeSelector?: string; env?: Record<string, string> },
  ) {
    return this.templates.deployFromTemplate(name, body);
  }
}
