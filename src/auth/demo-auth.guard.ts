import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';

export type AuthenticatedRequest = Request & { tenantId: string; userId: string };

@Injectable()
export class DemoAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const tokens = new Map([
      ['Bearer demo-alpha', { tenantId: 'alpha', userId: 'alpha-user-1' }],
      ['Bearer demo-alpha-2', { tenantId: 'alpha', userId: 'alpha-user-2' }],
      ['Bearer demo-beta', { tenantId: 'beta', userId: 'beta-user-1' }],
    ]);
    const identity = tokens.get(request.headers.authorization ?? '');
    if (!identity) throw new UnauthorizedException('Valid demo bearer token required');
    request.tenantId = identity.tenantId;
    request.userId = identity.userId;
    return true;
  }
}
