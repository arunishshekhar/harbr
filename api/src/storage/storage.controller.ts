import { Controller, Get } from '@nestjs/common';
import { StorageService } from './storage.service';

@Controller('storage')
export class StorageController {
  constructor(private storage: StorageService) {}

  @Get('status')
  async getStatus() { return this.storage.getStatus(); }

  @Get('volumes')
  async getVolumes() { return this.storage.getVolumes(); }
}
