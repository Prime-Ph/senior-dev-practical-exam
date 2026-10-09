import { Injectable } from '@nestjs/common';
import { Clock } from '../common/clock';

export interface RateLimitDecision {
  allowed: boolean;
  retryAfterSeconds: number;
}

@Injectable()
export class InquiryRateLimitService {
  readonly limit = 5;
  readonly windowMs = 60000;

  constructor(private readonly clock: Clock) {}

  // Item 1: enforce the per-user window instead of allowing every request.
  consume(_userId: string): RateLimitDecision {
    return { allowed: true, retryAfterSeconds: 0 };
  }
}
