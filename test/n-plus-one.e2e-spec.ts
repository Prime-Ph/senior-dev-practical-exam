import { get, testApp } from './helpers';

describe('Item 3: listing/agent query count', () => {
  let ctx: Awaited<ReturnType<typeof testApp>>;
  beforeEach(async () => { ctx = await testApp(); });
  afterEach(async () => { await ctx.app.close(); });

  it.each([5, 20])('returns %i listings with agents using at most two SQL queries', async (limit) => {
    const response = await get(ctx.app, '/listings?limit=' + limit).expect(200);
    expect(response.body).toHaveLength(limit);
    expect(response.body.map((row: { id: number }) => row.id)).toEqual(Array.from({ length: limit }, (_, i) => i + 1));
    const names = ['Alex', 'Sam', 'Jordan'];
    for (let i = 0; i < limit; i += 1) expect(response.body[i].agent.name).toBe(names[i % 3]);
    expect(ctx.db.metrics.queryCount).toBeLessThanOrEqual(2);
  });

  it('joins or batches agents inside the tenant boundary', async () => {
    const response = await get(ctx.app, '/listings?limit=50', 'demo-beta').expect(200);
    expect(response.body).toHaveLength(10);
    expect(response.body.every((row: { id: number; agent: { name: string } }) => row.id >= 101 && row.agent.name === 'Taylor')).toBe(true);
    expect(ctx.db.metrics.queryCount).toBeLessThanOrEqual(2);
  });
});
