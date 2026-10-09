import { Injectable, NotFoundException } from '@nestjs/common';
import { Database } from '../database/database';
import { ListingSummary, SummaryCache } from '../cache/summary-cache';

export interface Agent { id: number; name: string; }
export interface Listing { id: number; title: string; priceCents: number; agent: Agent; }

@Injectable()
export class ListingsService {
  constructor(private readonly db: Database, private readonly cache: SummaryCache) {}

  async list(tenantId: string, limit: number): Promise<Listing[]> {
    const listings = await this.db.query<{
      id: number; title: string; priceCents: number; agentId: number;
    }>('SELECT id, title, price_cents AS "priceCents", agent_id AS "agentId" FROM listings WHERE tenant_id = $1 ORDER BY id LIMIT $2', [tenantId, limit]);
    const result: Listing[] = [];
    // Item 3: replace per-listing agent queries with a join or batch query.
    for (const listing of listings) {
      const agents = await this.db.query<Agent>(
        'SELECT id, name FROM agents WHERE tenant_id = $1 AND id = $2', [tenantId, listing.agentId]);
      result.push({ id: listing.id, title: listing.title, priceCents: listing.priceCents, agent: agents[0] });
    }
    return result;
  }

  summary(tenantId: string): Promise<ListingSummary> {
    return this.cache.getOrLoad(tenantId, async () => {
      const rows = await this.db.query<ListingSummary>(
        'SELECT COUNT(*)::integer AS "totalListings", COALESCE(ROUND(AVG(price_cents)), 0)::integer AS "averagePriceCents" FROM listings WHERE tenant_id = $1',
        [tenantId]);
      return rows[0];
    });
  }

  async updatePrice(tenantId: string, id: number, priceCents: number) {
    const rows = await this.db.query<{ id: number; priceCents: number }>(
      'UPDATE listings SET price_cents = $3 WHERE tenant_id = $1 AND id = $2 RETURNING id, price_cents AS "priceCents"',
      [tenantId, id, priceCents]);
    if (!rows[0]) throw new NotFoundException('Listing not found');
    this.cache.invalidate(tenantId);
    return rows[0];
  }

  async inquire(tenantId: string, userId: string, listingId: number, message: string) {
    const rows = await this.db.query<{ id: number; listingId: number }>(
      'INSERT INTO inquiries (tenant_id, user_id, listing_id, message) SELECT $1, $2, id, $4 FROM listings WHERE tenant_id = $1 AND id = $3 RETURNING id, listing_id AS "listingId"',
      [tenantId, userId, listingId, message]);
    if (!rows[0]) throw new NotFoundException('Listing not found');
    return rows[0];
  }
}
