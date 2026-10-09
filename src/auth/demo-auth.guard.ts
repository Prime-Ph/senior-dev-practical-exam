import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';

export type TenantRequest = Request & { tenantId: string };

@Injectable()
export class DemoAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<TenantRequest>();
    const tokens = new Map([
      ['Bearer demo-alpha', 'alpha'],
      ['Bearer demo-beta', 'beta'],
    ]);
    const tenant = tokens.get(request.headers.authorization ?? '');
    if (!tenant) throw new UnauthorizedException('Valid demo bearer token required');
    request.tenantId = tenant;
    return true;
  }
}
