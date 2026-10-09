import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createApp } from '../src/create-app';
import { ReservationsService } from '../src/reservations/reservations.service';
import { SharedStorageBackend } from '../src/storage/shared-storage.backend';

describe('Scalability requirements', () => {
  let backend: SharedStorageBackend;
  let apps: INestApplication[];

  beforeEach(() => { backend = new SharedStorageBackend(); apps = []; });
  afterEach(async () => { await Promise.all(apps.map((app) => app.close())); });

  async function instance() {
    const app = await createApp(backend);
    await app.init();
    apps.push(app);
    return app;
  }

  it('preserves stock across independent application instances', async () => {
    const a = (await instance()).get(ReservationsService);
    const b = (await instance()).get(ReservationsService);
    const results = await Promise.allSettled([
      a.create('alpha', 'instance-a', { itemId: 'desk', quantity: 2 }),
      b.create('alpha', 'instance-b', { itemId: 'desk', quantity: 2 }),
    ]);
    expect(results.filter((row) => row.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.find((row) => row.status === 'rejected') as PromiseRejectedResult;
    expect(rejected.reason.getStatus()).toBe(409);
    expect((await a.inventory('alpha', 'desk')).available).toBe(1);
    expect((await a.list('alpha', 20, 0)).items).toHaveLength(1);
  });

  it('commits one reservation for identical retries across instances', async () => {
    const a = (await instance()).get(ReservationsService);
    const b = (await instance()).get(ReservationsService);
    const rows = await Promise.all(Array.from({ length: 8 }, (_, i) =>
      (i % 2 ? a : b).create('alpha', 'cluster-retry', { itemId: 'desk', quantity: 1 })));
    expect(new Set(rows.map((row) => row.id)).size).toBe(1);
    expect((await a.inventory('alpha', 'desk')).available).toBe(2);
    expect((await a.list('alpha', 20, 0)).items).toHaveLength(1);
  });

  it('coordinates a tenant key across different items and instances', async () => {
    const a = (await instance()).get(ReservationsService);
    const b = (await instance()).get(ReservationsService);
    const results = await Promise.allSettled([
      a.create('alpha', 'cross-item', { itemId: 'desk', quantity: 1 }),
      b.create('alpha', 'cross-item', { itemId: 'room', quantity: 1 }),
    ]);
    expect(results.filter((row) => row.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.find((row) => row.status === 'rejected') as PromiseRejectedResult;
    expect(rejected.reason.getStatus()).toBe(409);
    const consumed = 5 - (await a.inventory('alpha', 'desk')).available - (await a.inventory('alpha', 'room')).available;
    expect(consumed).toBe(1);
    expect((await a.list('alpha', 20, 0)).items).toHaveLength(1);
  });

  it('allows independent items and tenants to progress while one stock read is stalled', async () => {
    const service = (await instance()).get(ReservationsService);
    const pause = backend.pauseNextStockRead('alpha', 'desk');
    const stalled = service.create('alpha', 'stalled', { itemId: 'desk', quantity: 1 });
    await pause.entered;
    const independent = [
      service.create('alpha', 'other-item', { itemId: 'room', quantity: 1 }),
      service.create('beta', 'other-tenant', { itemId: 'desk', quantity: 1 }),
    ];
    let timer: NodeJS.Timeout | undefined;
    try {
      // Deadlock guard only. This is not a throughput or latency SLA.
      const rows = await Promise.race([
        Promise.all(independent),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error('Independent work is blocked behind unrelated stock')), 1500);
        }),
      ]);
      expect(rows.map((row) => row.tenantId)).toEqual(['alpha', 'beta']);
    } finally {
      if (timer) clearTimeout(timer);
      pause.release();
      await Promise.allSettled([stalled, ...independent]);
    }
  });

  it('looks up an existing tenant key without scanning reservation history', async () => {
    backend.seedHistoricalReservations(10000);
    const service = (await instance()).get(ReservationsService);
    backend.resetMetrics();
    const row = await service.create('alpha', 'history-alpha-9999', { itemId: 'retired-item', quantity: 1 });
    expect(row.id).toBe('history-alpha-9999');
    expect(backend.metrics.keyRowsVisited).toBe(1);
  });

  it('checks a new tenant key without scanning reservation history', async () => {
    backend.seedHistoricalReservations(10000);
    const service = (await instance()).get(ReservationsService);
    backend.resetMetrics();
    await service.create('alpha', 'new-key', { itemId: 'desk', quantity: 1 });
    expect(backend.metrics.keyRowsVisited).toBeLessThanOrEqual(1);
    expect((await service.inventory('alpha', 'desk')).available).toBe(2);
  });

  it('reads a small late page without scanning other tenants or skipped rows', async () => {
    backend.seedHistoricalReservations(10000, 'alpha');
    backend.seedHistoricalReservations(5000, 'beta');
    const app = await instance();
    backend.resetMetrics();
    const page = await request(app.getHttpServer()).get('/reservations')
      .set('Authorization', 'Bearer demo-alpha').query({ limit: 10, cursor: '9000' }).expect(200);
    expect(page.body.items).toHaveLength(10);
    expect(page.body.items.every((row: { tenantId: string }) => row.tenantId === 'alpha')).toBe(true);
    expect(page.body.nextCursor).toBe('9010');
    expect(backend.metrics.listRowsVisited).toBeLessThanOrEqual(11);
  });

  it('paginates in commit order with bounded defaults and validated parameters', async () => {
    backend.seedHistoricalReservations(75);
    backend.seedHistoricalReservations(5, 'beta');
    const app = await instance();
    const get = (query: object) => request(app.getHttpServer()).get('/reservations')
      .set('Authorization', 'Bearer demo-alpha').query(query);
    const first = await get({}).expect(200);
    expect(first.body.items).toHaveLength(20);
    expect(first.body.nextCursor).toBe('20');
    const ids: string[] = [];
    let cursor: string | null = '0';
    while (cursor !== null) {
      const page: { body: { items: Array<{ id: string }>; nextCursor: string | null } } = await get({ limit: 20, cursor }).expect(200);
      expect(page.body.items.length).toBeLessThanOrEqual(20);
      ids.push(...page.body.items.map((row: { id: string }) => row.id));
      cursor = page.body.nextCursor;
    }
    expect(ids).toHaveLength(75);
    expect(new Set(ids).size).toBe(75);
    expect((await get({ cursor: '1000' }).expect(200)).body).toEqual({ items: [], nextCursor: null });
    for (const query of [{ limit: 0 }, { limit: 101 }, { cursor: '-1' }, { cursor: 'abc' }]) {
      await get(query).expect(400);
    }
  });

  it('allows independent tenants to use the same key across instances', async () => {
    const a = (await instance()).get(ReservationsService);
    const b = (await instance()).get(ReservationsService);
    const rows = await Promise.all([
      a.create('alpha', 'tenant-key', { itemId: 'desk', quantity: 1 }),
      b.create('beta', 'tenant-key', { itemId: 'desk', quantity: 1 }),
    ]);
    expect(rows.map((row) => row.tenantId)).toEqual(['alpha', 'beta']);
    expect(rows[0].id).not.toBe(rows[1].id);
  });
});
