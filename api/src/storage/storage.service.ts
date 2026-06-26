import { Injectable } from '@nestjs/common';

@Injectable()
export class StorageService {
  async getStatus() {
    return {
      provider: 'longhorn',
      status: 'healthy',
      replicas: 3,
    };
  }
}
