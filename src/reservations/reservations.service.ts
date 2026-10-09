import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { InMemoryStore } from '../storage/in-memory.store';
import { CreateReservationDto } from './create-reservation.dto';
import { Reservation, Stock } from '../domain';

@Injectable()
export class ReservationsService {
  private tail: Promise<void> = Promise.resolve();

  constructor(private readonly store: InMemoryStore) {}

  // Existing workaround: serialize all writes in this application instance.
  private serial<T>(work: () => Promise<T>): Promise<T> {
    const next = this.tail.then(work);
    this.tail = next.then(() => undefined, () => undefined);
    return next;
  }

  async create(tenantId: string, key: string, input: CreateReservationDto): Promise<Reservation> {
    if (typeof key !== 'string' || key.length > 64 || !/^[A-Za-z0-9_-]+$/.test(key)) {
      throw new BadRequestException('Invalid idempotency key');
    }
    return this.serial(() => this.store.transaction([], async (tx) => {
      const existing = await tx.findByKey(tenantId, key);
      if (existing) {
        if (existing.itemId !== input.itemId || existing.quantity !== input.quantity) {
          throw new ConflictException('Key already used for a different payload');
        }
        return existing;
      }
      const stock = await tx.findStock(tenantId, input.itemId);
      if (!stock) throw new NotFoundException('Item not found');
      if (stock.available < input.quantity) throw new ConflictException('Insufficient stock');

      stock.available -= input.quantity;
      await tx.saveStock(stock);
      const reservation: Reservation = {
        id: randomUUID(), tenantId, itemId: input.itemId,
        quantity: input.quantity, idempotencyKey: key,
      };
      await tx.saveReservation(reservation);
      return reservation;
    }));
  }

  async get(tenantId: string, id: string): Promise<Reservation> {
    const row = await this.store.findReservation(tenantId, id);
    if (!row) throw new NotFoundException('Reservation not found');
    return row;
  }

  list(tenantId: string, limit: number, offset: number) {
    return this.store.listReservations(tenantId, limit, offset);
  }

  async inventory(tenantId: string, itemId: string): Promise<Stock> {
    const row = await this.store.findStock(tenantId, itemId);
    if (!row) throw new NotFoundException('Item not found');
    return row;
  }
}
