import { NestFactory } from '@nestjs/core';
import { WorkerModule } from './worker.module';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(WorkerModule);
  await app.init();
  console.log('[Harbr Worker] Started - processing jobs from Redis queue');
}
bootstrap().catch(console.error);
