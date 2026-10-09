import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { inventory, list, reserve, testApp } from './helpers';

describe('Starter smoke checks', () => {
  let app: INestApplication;
  beforeEach(async () => { app = await testApp(); });
  afterEach(async () => { await app.close(); });

  it('creates a reservation and deducts stock', async () => {
    const created = await reserve(app, 'smoke').expect(201);
    expect(created.body).toEqual({
      id: expect.any(String), tenantId: 'alpha', itemId: 'desk',
      quantity: 1, idempotencyKey: 'smoke',
    });
    expect((await inventory(app).expect(200)).body.available).toBe(2);
    const read = await request(app.getHttpServer()).get(`/reservations/${created.body.id}`)
      .set('Authorization', 'Bearer demo-alpha').expect(200);
    expect(read.body).toEqual(created.body);
  });

  it('rejects unauthenticated and unrecognized tokens', async () => {
    await request(app.getHttpServer()).get('/reservations').expect(401);
    await request(app.getHttpServer()).get('/reservations')
      .set('Authorization', 'Bearer unknown').expect(401);
  });

  it('rejects insufficient stock without mutation', async () => {
    await reserve(app, 'too-many', { itemId: 'desk', quantity: 4 }).expect(409);
    expect((await inventory(app)).body.available).toBe(3);
    expect((await list(app)).body.items).toEqual([]);
  });

  it('returns 404 for unknown and foreign inventory', async () => {
    await inventory(app, 'alpha', 'missing').expect(404);
    await inventory(app, 'alpha', 'beta-only').expect(404);
  });
});
