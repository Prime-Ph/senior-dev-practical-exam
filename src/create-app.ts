import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

// Shared by the server and HTTP tests so application setup is exercised in both.
export async function createApp() {
  return NestFactory.create(AppModule, { logger: false });
}
