import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuditService } from './audit.service';

@Controller('audit')
@UseGuards(AuthGuard('jwt'))
export class AuditController {
  constructor(private audit: AuditService) {}

  @Get()
  async findAll(@Query('page') page = '1', @Query('limit') limit = '50') {
    return this.audit.findAll(parseInt(page), parseInt(limit));
  }
}
