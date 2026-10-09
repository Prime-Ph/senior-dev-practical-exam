import request from 'supertest';
import { get, testApp } from './helpers';

describe('Item 2: listing-summary cache', () => {
  let ctx: Awaited<ReturnType<typeof testApp>>;
  beforeEach(async () => { ctx = await testApp(); });
  afterEach(async () => { await ctx.app.close(); });

  it('serves an identical repeat without querying PostgreSQL again', async () => {
    const first = await get(ctx.app, '/summary').expect(200);
    const second = await get(ctx.app, '/summary').expect(200);
    expect(second.body).toEqual(first.body);
    expect(ctx.db.metrics.queryCount).toBe(1);
  });

  it('expires at 30 seconds without extending TTL on a hit', async () => {
    await get(ctx.app, '/summary').expect(200);
    ctx.clock.advance(29999);
    await get(ctx.app, '/summary').expect(200);
    expect(ctx.db.metrics.queryCount).toBe(1);
    ctx.clock.advance(1);
    await get(ctx.app, '/summary').expect(200);
    expect(ctx.db.metrics.queryCount).toBe(2);
  });

  it('uses separate cache entries for each tenant', async () => {
    const alpha = await get(ctx.app, '/summary').expect(200);
    const beta = await get(ctx.app, '/summary', 'demo-beta').expect(200);
    const replay = await get(ctx.app, '/summary').expect(200);
    expect(alpha.body.totalListings).toBe(30);
    expect(beta.body.totalListings).toBe(10);
    expect(replay.body).toEqual(alpha.body);
    expect(ctx.db.metrics.queryCount).toBe(2);
  });

  it('invalidates only the changed tenant after a successful price update', async () => {
    await get(ctx.app, '/summary').expect(200);
    await get(ctx.app, '/summary', 'demo-beta').expect(200);
    ctx.db.resetMetrics();
    await request(ctx.app.getHttpServer()).patch('/listings/1/price').set('Authorization', 'Bearer demo-alpha')
      .send({ priceCents: 20000000 }).expect(200);
    const changed = await get(ctx.app, '/summary').expect(200);
    expect(changed.body.averagePriceCents).toBe(11880000);
    await get(ctx.app, '/summary', 'demo-beta').expect(200);
    expect(ctx.db.metrics.queryCount).toBe(2); // One UPDATE, one Alpha refresh; Beta stays cached.
  });
});
