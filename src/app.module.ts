import { DynamicModule, Module } from '@nestjs/common';
import { DemoAuthGuard } from './auth/demo-auth.guard';
import { Clock } from './common/clock';
import { Database } from './database/database';
import { SummaryCache } from './cache/summary-cache';
import { InquiryRateLimitGuard } from './rate-limit/inquiry-rate-limit.guard';
import { InquiryRateLimitService } from './rate-limit/inquiry-rate-limit.service';
import { ListingsController } from './listings/listings.controller';
import { ListingsService } from './listings/listings.service';

@Module({})
export class AppModule {
  static forDatabase(db: Database, clock: Clock): DynamicModule {
    return {
      module: AppModule,
      controllers: [ListingsController],
      providers: [
        { provide: Database, useValue: db }, { provide: Clock, useValue: clock },
        ListingsService, SummaryCache, DemoAuthGuard, InquiryRateLimitGuard, InquiryRateLimitService,
      ],
    };
  }
}
