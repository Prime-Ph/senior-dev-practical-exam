import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Clock } from './common/clock';
import { Database } from './database/database';

export async function createApp(db = new Database(), clock = new Clock()) {
  const app = await NestFactory.create(AppModule.forDatabase(db, clock), { logger: false });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: false }));
  return app;
}
