import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { InMemoryStore } from '../storage/in-memory.store';
import { CreateReservationDto } from './create-reservation.dto';
import { Reservation, Stock } from '../domain';

@Injectable()
export class ReservationsService {
  constructor(private readonly store: InMemoryStore) {}

  async create(tenantId: string, key: string, input: CreateReservationDto): Promise<Reservation> {
    const existing = await this.store.findByKey(key);
    if (existing) return existing;

    const stock = await this.store.findStock(tenantId, input.itemId);
    if (!stock) throw new NotFoundException('Item not found');
    if (stock.available < input.quantity) throw new ConflictException('Insufficient stock');

    stock.available -= input.quantity;
    await this.store.saveStock(stock);
    const reservation: Reservation = {
      id: randomUUID(), tenantId, itemId: input.itemId,
      quantity: input.quantity, idempotencyKey: key,
    };
    await this.store.saveReservation(reservation);
    return reservation;
  }

  async get(id: string): Promise<Reservation> {
    const reservation = await this.store.findReservation(id);
    if (!reservation) throw new NotFoundException('Reservation not found');
    return reservation;
  }

  async list(): Promise<Reservation[]> {
    return this.store.listReservations();
  }

  async inventory(tenantId: string, itemId: string): Promise<Stock> {
    const stock = await this.store.findStock(tenantId, itemId);
    if (!stock) throw new NotFoundException('Item not found');
    return stock;
  }
}
