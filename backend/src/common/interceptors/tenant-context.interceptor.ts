import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { TenantContextService, TenantContextPayload } from '../tenant/tenant-context.service';

@Injectable()
export class TenantContextInterceptor implements NestInterceptor {
  constructor(private readonly tenantContextService: TenantContextService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (user && user.tenantId && user.schemaName) {
      const payload: TenantContextPayload = {
        tenantId: user.tenantId,
        schemaName: user.schemaName,
        userId: user.sub,
        role: user.role,
        subscriptionStatus: user.subscriptionStatus || 'ACTIVE',
      };

      return new Observable((subscriber) => {
        this.tenantContextService.run(payload, async () => {
          next.handle().subscribe({
            next: (v) => subscriber.next(v),
            error: (e) => subscriber.error(e),
            complete: () => subscriber.complete(),
          });
        });
      });
    }

    return next.handle();
  }
}
