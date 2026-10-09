import { Injectable } from '@nestjs/common';
import { Reservation, Stock } from '../domain';

@Injectable()
export class InMemoryStore {
  private readonly stocks = new Map<string, Stock>([
    ['alpha:desk', { tenantId: 'alpha', itemId: 'desk', available: 3 }],
    ['alpha:room', { tenantId: 'alpha', itemId: 'room', available: 2 }],
    ['beta:desk', { tenantId: 'beta', itemId: 'desk', available: 10 }],
    ['beta:beta-only', { tenantId: 'beta', itemId: 'beta-only', available: 4 }],
  ]);
  private readonly reservations = new Map<string, Reservation>();
  private failNextWrite = false;

  private async io(): Promise<void> {
    await new Promise<void>((resolve) => setImmediate(resolve));
  }

  async findStock(tenantId: string, itemId: string): Promise<Stock | undefined> {
    await this.io();
    const stock = this.stocks.get(`${tenantId}:${itemId}`);
    return stock ? { ...stock } : undefined;
  }

  async saveStock(stock: Stock): Promise<void> {
    await this.io();
    this.stocks.set(`${stock.tenantId}:${stock.itemId}`, { ...stock });
  }

  async findByKey(key: string): Promise<Reservation | undefined> {
    await this.io();
    const reservation = [...this.reservations.values()].find((row) => row.idempotencyKey === key);
    return reservation ? { ...reservation } : undefined;
  }

  async saveReservation(reservation: Reservation): Promise<void> {
    await this.io();
    if (this.failNextWrite) {
      this.failNextWrite = false;
      throw new Error('Simulated reservation persistence failure');
    }
    this.reservations.set(reservation.id, { ...reservation });
  }

  async findReservation(id: string): Promise<Reservation | undefined> {
    await this.io();
    const row = this.reservations.get(id);
    return row ? { ...row } : undefined;
  }

  async listReservations(): Promise<Reservation[]> {
    await this.io();
    return [...this.reservations.values()].map((row) => ({ ...row }));
  }

  // Test seam only: the next persistence attempt fails before saving a reservation.
  failNextReservationWrite(): void {
    this.failNextWrite = true;
  }
}
