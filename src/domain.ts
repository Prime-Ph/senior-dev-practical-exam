export interface Stock {
  tenantId: string;
  itemId: string;
  available: number;
}

export interface Reservation {
  id: string;
  tenantId: string;
  itemId: string;
  quantity: number;
  idempotencyKey: string;
}
