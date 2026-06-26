import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { StorageService } from './storage.service';

@Controller('storage')
@UseGuards(AuthGuard('jwt'))
export class StorageController {
  constructor(private storage: StorageService) {}

  @Get('status')
  async getStatus() { return this.storage.getStatus(); }
}
