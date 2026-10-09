import request from 'supertest';
import { get, inquire, testApp } from './helpers';

describe('Working starter behavior', () => {
  let ctx: Awaited<ReturnType<typeof testApp>>;
  beforeEach(async () => { ctx = await testApp(); });
  afterEach(async () => { await ctx.app.close(); });

  it('reads seeded listings and tenant-scoped agents', async () => {
    const alpha = await get(ctx.app, '/listings?limit=2').expect(200);
    expect(alpha.body).toEqual([
      { id: 1, title: 'Alpha Office 1', priceCents: 10100000, agent: { id: 1, name: 'Alex' } },
      { id: 2, title: 'Alpha Office 2', priceCents: 10200000, agent: { id: 2, name: 'Sam' } },
    ]);
    const beta = await get(ctx.app, '/listings?limit=1', 'demo-beta').expect(200);
    expect(beta.body[0].id).toBe(101);
    expect(beta.body[0].agent).toEqual({ id: 1, name: 'Taylor' });
  });

  it('persists an inquiry for an owned listing', async () => {
    const response = await inquire(ctx.app).expect(201);
    expect(response.body).toEqual({ id: expect.any(Number), listingId: 1 });
    const rows = await ctx.db.query<{ user_id: string }>('SELECT user_id FROM inquiries');
    expect(rows).toEqual([{ user_id: 'alpha-user-1' }]);
  });

  it('enforces authentication and runtime validation', async () => {
    await request(ctx.app.getHttpServer()).get('/listings').expect(401);
    await get(ctx.app, '/listings', 'invalid').expect(401);
    await request(ctx.app.getHttpServer()).post('/inquiries').set('Authorization', 'Bearer demo-alpha')
      .send({ listingId: 0, message: 'Interested' }).expect(400);
    await request(ctx.app.getHttpServer()).patch('/listings/1/price').set('Authorization', 'Bearer demo-alpha')
      .send({ priceCents: 100, tenantId: 'beta' }).expect(400);
    await get(ctx.app, '/listings?limit=0').expect(400);
    await get(ctx.app, '/listings?limit=51').expect(400);
  });

  it('updates price and returns the current summary', async () => {
    expect((await get(ctx.app, '/summary').expect(200)).body).toEqual({ totalListings: 30, averagePriceCents: 11550000 });
    await request(ctx.app.getHttpServer()).patch('/listings/1/price')
      .set('Authorization', 'Bearer demo-alpha').send({ priceCents: 20000000 }).expect(200);
    expect((await get(ctx.app, '/summary').expect(200)).body).toEqual({ totalListings: 30, averagePriceCents: 11880000 });
  });

  it('hides foreign and missing listings on writes', async () => {
    await request(ctx.app.getHttpServer()).post('/inquiries').set('Authorization', 'Bearer demo-alpha')
      .send({ listingId: 101, message: 'Interested' }).expect(404);
    await request(ctx.app.getHttpServer()).patch('/listings/101/price').set('Authorization', 'Bearer demo-alpha')
      .send({ priceCents: 100 }).expect(404);
    await request(ctx.app.getHttpServer()).patch('/listings/999/price').set('Authorization', 'Bearer demo-alpha')
      .send({ priceCents: 100 }).expect(404);
  });
});
