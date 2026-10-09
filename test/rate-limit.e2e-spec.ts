import { get, inquire, testApp } from './helpers';

describe('Item 1: inquiry rate limiting', () => {
  let ctx: Awaited<ReturnType<typeof testApp>>;
  beforeEach(async () => { ctx = await testApp(); });
  afterEach(async () => { await ctx.app.close(); });

  it('allows five attempts, rejects the sixth with Retry-After, and avoids a database call', async () => {
    for (let i = 0; i < 5; i += 1) await inquire(ctx.app).expect(201);
    ctx.db.resetMetrics();
    const blocked = await inquire(ctx.app).expect(429);
    expect(Number(blocked.headers['retry-after'])).toBe(60);
    expect(ctx.db.metrics.queryCount).toBe(0);
  });

  it('does not share the quota between users or apply it to GET routes', async () => {
    for (let i = 0; i < 5; i += 1) await inquire(ctx.app).expect(201);
    await inquire(ctx.app, 'demo-alpha-2').expect(201);
    for (let i = 0; i < 6; i += 1) await get(ctx.app, '/listings?limit=1').expect(200);
  });

  it('keeps the first-attempt window until 60 seconds and then resets it', async () => {
    for (let i = 0; i < 5; i += 1) await inquire(ctx.app).expect(201);
    ctx.clock.advance(59999);
    const blocked = await inquire(ctx.app).expect(429);
    expect(Number(blocked.headers['retry-after'])).toBe(1);
    ctx.clock.advance(1);
    await inquire(ctx.app).expect(201);
  });

  it('admits only five of ten concurrent requests from the same user', async () => {
    const results = await Promise.all(Array.from({ length: 10 }, () => inquire(ctx.app)));
    expect(results.filter((row) => row.status === 201)).toHaveLength(5);
    expect(results.filter((row) => row.status === 429)).toHaveLength(5);
    const rows = await ctx.db.query<{ count: number }>('SELECT COUNT(*)::integer AS count FROM inquiries');
    expect(rows[0].count).toBe(5);
  });
});
