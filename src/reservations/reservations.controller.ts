import { BadRequestException, Body, Controller, Get, Headers, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { DemoAuthGuard, TenantRequest } from '../auth/demo-auth.guard';
import { CreateReservationDto } from './create-reservation.dto';
import { ReservationsService } from './reservations.service';

function pageNumber(value: unknown, fallback: number, max: number, allowZero = false): number {
  if (value === undefined) return fallback;
  if (typeof value !== 'string' || !/^(0|[1-9][0-9]*)$/.test(value)) {
    throw new BadRequestException('Invalid pagination parameter');
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed > max || parsed < (allowZero ? 0 : 1)) {
    throw new BadRequestException('Invalid pagination parameter');
  }
  return parsed;
}

@Controller()
@UseGuards(DemoAuthGuard)
export class ReservationsController {
  constructor(private readonly reservations: ReservationsService) {}

  @Post('reservations')
  create(@Req() request: TenantRequest, @Headers('idempotency-key') key: string,
    @Body() body: CreateReservationDto) {
    return this.reservations.create(request.tenantId, key, body);
  }

  @Get('reservations')
  list(@Req() request: TenantRequest, @Query('limit') limit: unknown, @Query('cursor') cursor: unknown) {
    return this.reservations.list(request.tenantId,
      pageNumber(limit, 20, 100), pageNumber(cursor, 0, Number.MAX_SAFE_INTEGER, true));
  }

  @Get('reservations/:id')
  get(@Req() request: TenantRequest, @Param('id') id: string) {
    return this.reservations.get(request.tenantId, id);
  }

  @Get('inventory/:itemId')
  inventory(@Req() request: TenantRequest, @Param('itemId') itemId: string) {
    return this.reservations.inventory(request.tenantId, itemId);
  }
}
