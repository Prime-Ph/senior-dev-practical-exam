import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { ReservationsService } from '../src/reservations/reservations.service';
import { InMemoryStore } from '../src/storage/in-memory.store';
import { inventory, list, reserve, testApp } from './helpers';

describe('Reservation incident regressions', () => {
  let app: INestApplication;
  beforeEach(async () => { app = await testApp(); });
  afterEach(async () => { await app.close(); });

  it('allows only one of two overlapping reservations when stock is insufficient for both', async () => {
    // Start both service calls before yielding: no HTTP arrival timing or sleeps.
    const service = app.get(ReservationsService);
    const results = await Promise.allSettled([
      service.create('alpha', 'race-a', { itemId: 'desk', quantity: 2 }),
      service.create('alpha', 'race-b', { itemId: 'desk', quantity: 2 }),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    const failed = results.find((result) => result.status === 'rejected') as PromiseRejectedResult;
    expect(failed.reason.getStatus()).toBe(409);
    expect((await inventory(app)).body.available).toBe(1);
    const rows = (await list(app)).body;
    expect(rows).toHaveLength(1);
    expect(rows.reduce((total: number, row: { quantity: number }) => total + row.quantity, 0)).toBe(2);
  });

  it('replays overlapping identical requests exactly once', async () => {
    const service = app.get(ReservationsService);
    const rows = await Promise.all(Array.from({ length: 5 }, () =>
      service.create('alpha', 'same-key', { itemId: 'desk', quantity: 1 })));
    expect(new Set(rows.map((row) => row.id)).size).toBe(1);
    expect((await inventory(app)).body.available).toBe(2);
    expect((await list(app)).body).toHaveLength(1);
  });

  it('rejects a changed payload for a completed key', async () => {
    await reserve(app, 'changed').expect(201);
    await reserve(app, 'changed', { itemId: 'desk', quantity: 2 }).expect(409);
    expect((await inventory(app)).body.available).toBe(2);
    expect((await list(app)).body).toHaveLength(1);
  });

  it('scopes identical keys independently to each tenant', async () => {
    const alpha = await reserve(app, 'shared').expect(201);
    const beta = await reserve(app, 'shared', { itemId: 'desk', quantity: 1 }, 'beta').expect(201);
    expect(beta.body.tenantId).toBe('beta');
    expect(beta.body.id).not.toBe(alpha.body.id);
    expect((await inventory(app, 'alpha')).body.available).toBe(2);
    expect((await inventory(app, 'beta')).body.available).toBe(9);
  });

  it('hides foreign reservations and filters list reads', async () => {
    const alpha = await reserve(app, 'alpha-booking').expect(201);
    await request(app.getHttpServer()).get(`/reservations/${alpha.body.id}`)
      .set('Authorization', 'Bearer demo-beta').expect(404);
    expect((await list(app, 'beta')).body).toEqual([]);
    expect((await list(app, 'alpha')).body).toHaveLength(1);
  });

  it.each([0, -1, 1.5, '1', null, Number.MAX_SAFE_INTEGER + 1])('rejects invalid quantity %p without mutation', async (quantity) => {
    await reserve(app, 'invalid', { itemId: 'desk', quantity }).expect(400);
    expect((await inventory(app)).body.available).toBe(3);
    expect((await list(app)).body).toEqual([]);
  });

  it('requires a valid idempotency key', async () => {
    await request(app.getHttpServer()).post('/reservations')
      .set('Authorization', 'Bearer demo-alpha')
      .send({ itemId: 'desk', quantity: 1 }).expect(400);
    expect((await inventory(app)).body.available).toBe(3);
    expect((await list(app)).body).toEqual([]);
  });

  it('rejects unknown properties before mutating stock', async () => {
    await reserve(app, 'spoof', { itemId: 'desk', quantity: 1, tenantId: 'beta' }).expect(400);
    expect((await inventory(app, 'alpha')).body.available).toBe(3);
    expect((await inventory(app, 'beta')).body.available).toBe(10);
  });

  it('rolls back a failed write and allows a retry with the same key', async () => {
    app.get(InMemoryStore).failNextReservationWrite();
    await reserve(app, 'retry-after-failure').expect(500);
    expect((await inventory(app)).body.available).toBe(3);
    expect((await list(app)).body).toEqual([]);
    await reserve(app, 'retry-after-failure').expect(201);
    expect((await inventory(app)).body.available).toBe(2);
    expect((await list(app)).body).toHaveLength(1);
  });
});
