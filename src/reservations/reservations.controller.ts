import { Body, Controller, Get, Headers, Param, Post, Req, UseGuards } from '@nestjs/common';
import { DemoAuthGuard, TenantRequest } from '../auth/demo-auth.guard';
import { CreateReservationDto } from './create-reservation.dto';
import { ReservationsService } from './reservations.service';

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
  list() {
    return this.reservations.list();
  }

  @Get('reservations/:id')
  get(@Param('id') id: string) {
    return this.reservations.get(id);
  }

  @Get('inventory/:itemId')
  inventory(@Req() request: TenantRequest, @Param('itemId') itemId: string) {
    return this.reservations.inventory(request.tenantId, itemId);
  }
}
