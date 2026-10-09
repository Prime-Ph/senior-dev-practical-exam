import { Injectable } from '@nestjs/common';
import { Clock } from '../common/clock';

export interface ListingSummary {
  totalListings: number;
  averagePriceCents: number;
}

@Injectable()
export class SummaryCache {
  readonly ttlMs = 30000;

  constructor(private readonly clock: Clock) {}

  // Item 2: serve valid tenant-scoped entries before calling load().
  async getOrLoad(_tenantId: string, load: () => Promise<ListingSummary>): Promise<ListingSummary> {
    return load();
  }

  invalidate(_tenantId: string): void {
    // Called after a successful price update; invalidation is not implemented yet.
  }
}
