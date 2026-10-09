import { DynamicModule, Module } from '@nestjs/common';
import { DemoAuthGuard } from './auth/demo-auth.guard';
import { ReservationsController } from './reservations/reservations.controller';
import { ReservationsService } from './reservations/reservations.service';
import { InMemoryStore } from './storage/in-memory.store';
import { SharedStorageBackend } from './storage/shared-storage.backend';

@Module({})
export class AppModule {
  static forBackend(backend: SharedStorageBackend): DynamicModule {
    return {
      module: AppModule,
      controllers: [ReservationsController],
      providers: [
        ReservationsService, InMemoryStore, DemoAuthGuard,
        { provide: SharedStorageBackend, useValue: backend },
      ],
    };
  }
}
