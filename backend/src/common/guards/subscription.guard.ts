import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { TenantContextService } from '../tenant/tenant-context.service';

@Injectable()
export class SubscriptionGuard implements CanActivate {
  constructor(private readonly tenantContext: TenantContextService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const method = request.method?.toUpperCase();

    const ctx = this.tenantContext.getContext();
    if (!ctx) {
      return true; // If no tenant context (e.g. public or super admin), allow
    }

    // If subscription is ACTIVE, allow everything
    if (ctx.subscriptionStatus === 'ACTIVE') {
      return true;
    }

    // If subscription is EXPIRED or SUSPENDED, allow GET requests only (Read-Only Mode)
    if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
      return true;
    }

    // Block any mutating operations
    throw new ForbiddenException(
      'انتهى اشتراك الصيدلية. النظام حالياً في وضع القراءة فقط. يرجى تجديد الاشتراك للمتابعة.',
    );
  }
}
