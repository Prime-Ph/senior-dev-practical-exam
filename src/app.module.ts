import { Module } from '@nestjs/common';
import { DemoAuthGuard } from './auth/demo-auth.guard';
import { ReservationsController } from './reservations/reservations.controller';
import { ReservationsService } from './reservations/reservations.service';
import { InMemoryStore } from './storage/in-memory.store';

@Module({
  controllers: [ReservationsController],
  providers: [ReservationsService, InMemoryStore, DemoAuthGuard],
})
export class AppModule {}
