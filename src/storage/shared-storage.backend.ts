import { Reservation, Stock } from '../domain';

export interface ReservationPage {
  items: Reservation[];
  nextCursor: string | null;
}

export interface ReadPause {
  entered: Promise<void>;
  release(): void;
}

export class SharedStorageBackend {
  private readonly stocks = new Map<string, Stock>([
    ['alpha:desk', { tenantId: 'alpha', itemId: 'desk', available: 3 }],
    ['alpha:room', { tenantId: 'alpha', itemId: 'room', available: 2 }],
    ['beta:desk', { tenantId: 'beta', itemId: 'desk', available: 10 }],
    ['beta:beta-only', { tenantId: 'beta', itemId: 'beta-only', available: 4 }],
  ]);
  private readonly reservations = new Map<string, Reservation>();
  private readonly lockTails = new Map<string, Promise<void>>();
  private failNextWrite = false;
  private historySequence = 0;
  private pause?: { resource: string; enter(): void; wait: Promise<void> };

  readonly metrics = { keyRowsVisited: 0, listRowsVisited: 0, reservationWrites: 0 };

  constructor(private readonly ioDelayMs = 0) {}

  async io(): Promise<void> {
    await new Promise<void>((resolve) => {
      if (this.ioDelayMs > 0) setTimeout(resolve, this.ioDelayMs);
      else setImmediate(resolve);
    });
  }

  // Simulates shared-storage row locks. Empty keys mean no shared coordination.
  // This fixture runs in one process; it is not a distributed lock implementation.
  async transaction<T>(resourceKeys: string[], work: (tx: StorageTransaction) => Promise<T>): Promise<T> {
    const held: Array<{ key: string; tail: Promise<void>; release(): void }> = [];
    try {
      for (const key of [...new Set(resourceKeys)].sort()) {
        const previous = this.lockTails.get(key) ?? Promise.resolve();
        let release!: () => void;
        const gate = new Promise<void>((resolve) => { release = resolve; });
        const tail = previous.then(() => gate);
        this.lockTails.set(key, tail);
        await previous;
        held.push({ key, tail, release });
      }
      const tx = new StorageTransaction(this);
      const result = await work(tx);
      await this.io();
      tx.commit();
      return result;
    } finally {
      for (const lock of held.reverse()) {
        lock.release();
        if (this.lockTails.get(lock.key) === lock.tail) this.lockTails.delete(lock.key);
      }
    }
  }

  async findStock(tenantId: string, itemId: string): Promise<Stock | undefined> {
    await this.io();
    const resource = tenantId + ':' + itemId;
    if (this.pause?.resource === resource) {
      const pause = this.pause;
      this.pause = undefined;
      pause.enter();
      await pause.wait;
    }
    const row = this.stocks.get(resource);
    return row ? { ...row } : undefined;
  }

  async findByKey(tenantId: string, key: string): Promise<Reservation | undefined> {
    await this.io();
    for (const row of this.reservations.values()) {
      this.metrics.keyRowsVisited += 1;
      if (row.tenantId === tenantId && row.idempotencyKey === key) return { ...row };
    }
    return undefined;
  }

  async findReservation(tenantId: string, id: string): Promise<Reservation | undefined> {
    await this.io();
    const row = this.reservations.get(id);
    return row?.tenantId === tenantId ? { ...row } : undefined;
  }

  async listReservations(tenantId: string, limit: number, offset: number): Promise<ReservationPage> {
    await this.io();
    const owned: Reservation[] = [];
    for (const row of this.reservations.values()) {
      this.metrics.listRowsVisited += 1;
      if (row.tenantId === tenantId) owned.push(row);
    }
    return {
      items: owned.slice(offset, offset + limit).map((row) => ({ ...row })),
      nextCursor: offset + limit < owned.length ? String(offset + limit) : null,
    };
  }

  // Commit is all-or-nothing within this fixture; no yield occurs during publication.
  publish(stocks: Map<string, Stock>, reservations: Map<string, Reservation>): void {
    if (reservations.size && this.failNextWrite) {
      this.failNextWrite = false;
      throw new Error('Simulated reservation persistence failure');
    }
    for (const [key, row] of stocks) this.stocks.set(key, { ...row });
    for (const [id, row] of reservations) this.reservations.set(id, { ...row });
    this.metrics.reservationWrites += reservations.size;
  }

  failNextReservationWrite(): void { this.failNextWrite = true; }

  resetMetrics(): void {
    this.metrics.keyRowsVisited = 0;
    this.metrics.listRowsVisited = 0;
    this.metrics.reservationWrites = 0;
  }

  // Test/benchmark fixtures only; no corresponding HTTP endpoints.
  seedHistoricalReservations(count: number, tenantId = 'alpha'): void {
    for (let i = 0; i < count; i += 1) {
      const id = 'history-' + tenantId + '-' + this.historySequence++;
      this.publish(new Map(), new Map([[id, {
        id, tenantId, itemId: 'retired-item', quantity: 1, idempotencyKey: id,
      }]]));
    }
  }

  setStockForFixture(tenantId: string, itemId: string, available: number): void {
    this.stocks.set(tenantId + ':' + itemId, { tenantId, itemId, available });
  }

  pauseNextStockRead(tenantId: string, itemId: string): ReadPause {
    if (this.pause) throw new Error('A stock read is already scheduled to pause');
    let enter!: () => void;
    let release!: () => void;
    const entered = new Promise<void>((resolve) => { enter = resolve; });
    const wait = new Promise<void>((resolve) => { release = resolve; });
    this.pause = { resource: tenantId + ':' + itemId, enter, wait };
    return { entered, release };
  }
}

export class StorageTransaction {
  private readonly stocks = new Map<string, Stock>();
  private readonly reservations = new Map<string, Reservation>();

  constructor(private readonly backend: SharedStorageBackend) {}

  findByKey(tenantId: string, key: string) { return this.backend.findByKey(tenantId, key); }
  findStock(tenantId: string, itemId: string) { return this.backend.findStock(tenantId, itemId); }

  async saveStock(row: Stock): Promise<void> {
    await this.backend.io();
    this.stocks.set(row.tenantId + ':' + row.itemId, { ...row });
  }

  async saveReservation(row: Reservation): Promise<void> {
    await this.backend.io();
    this.reservations.set(row.id, { ...row });
  }

  commit(): void { this.backend.publish(this.stocks, this.reservations); }
}
