import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SharedStorageBackend } from './storage/shared-storage.backend';

// Separate apps have separate providers/queues; tests can share the storage fixture.
export async function createApp(backend = new SharedStorageBackend()) {
  const app = await NestFactory.create(AppModule.forBackend(backend), { logger: false });
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true, forbidNonWhitelisted: true, transform: false,
  }));
  return app;
}
