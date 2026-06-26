import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { TemplatesService } from './templates.service';

@Controller('templates')
@UseGuards(AuthGuard('jwt'))
export class TemplatesController {
  constructor(private templates: TemplatesService) {}

  @Get()
  async findAll() { return this.templates.findAll(); }

  @Get(':name')
  async findByName(@Param('name') name: string) { return this.templates.findByName(name); }
}
