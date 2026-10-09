import { Injectable } from '@nestjs/common';
import { SharedStorageBackend, StorageTransaction } from './shared-storage.backend';

@Injectable()
export class InMemoryStore {
  constructor(private readonly backend: SharedStorageBackend) {}

  transaction<T>(resources: string[], work: (tx: StorageTransaction) => Promise<T>) {
    return this.backend.transaction(resources, work);
  }
  findStock(tenantId: string, itemId: string) { return this.backend.findStock(tenantId, itemId); }
  findReservation(tenantId: string, id: string) { return this.backend.findReservation(tenantId, id); }
  listReservations(tenantId: string, limit: number, offset: number) {
    return this.backend.listReservations(tenantId, limit, offset);
  }
  failNextReservationWrite(): void { this.backend.failNextReservationWrite(); }
}
