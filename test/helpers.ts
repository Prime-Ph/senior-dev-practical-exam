import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createApp } from '../src/create-app';

export async function testApp(): Promise<INestApplication> {
  const app = await createApp();
  await app.init();
  return app;
}

export function reserve(app: INestApplication, key: string, body: Record<string, unknown> = { itemId: 'desk', quantity: 1 }, tenant = 'alpha') {
  return request(app.getHttpServer()).post('/reservations')
    .set('Authorization', `Bearer demo-${tenant}`)
    .set('Idempotency-Key', key).send(body);
}

export function inventory(app: INestApplication, tenant = 'alpha', itemId = 'desk') {
  return request(app.getHttpServer()).get(`/inventory/${itemId}`)
    .set('Authorization', `Bearer demo-${tenant}`);
}

export function list(app: INestApplication, tenant = 'alpha') {
  return request(app.getHttpServer()).get('/reservations')
    .set('Authorization', `Bearer demo-${tenant}`);
}
