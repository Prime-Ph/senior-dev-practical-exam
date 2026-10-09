import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { Response } from 'express';
import { AuthenticatedRequest } from '../auth/demo-auth.guard';
import { InquiryRateLimitService } from './inquiry-rate-limit.service';

@Injectable()
export class InquiryRateLimitGuard implements CanActivate {
  constructor(private readonly limiter: InquiryRateLimitService) {}

  canActivate(context: ExecutionContext): boolean {
    const http = context.switchToHttp();
    const request = http.getRequest<AuthenticatedRequest>();
    const result = this.limiter.consume(request.userId);
    if (!result.allowed) {
      http.getResponse<Response>().setHeader('Retry-After', String(Math.max(1, result.retryAfterSeconds)));
      throw new HttpException('Inquiry rate limit exceeded', HttpStatus.TOO_MANY_REQUESTS);
    }
    return true;
  }
}
