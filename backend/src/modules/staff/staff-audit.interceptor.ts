import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { from, mergeMap, Observable, switchMap } from 'rxjs';
import { RequestContext } from 'common/request-context';
import { StaffAuditService } from './staff-audit.service';
import { HIDEABLE, resolveTarget } from './staff-entities';

/**
 * Global interceptor: for STAFF requests that change data, snapshot the row
 * before, run the handler, then log the action for admin review. Deletes in
 * "hide" mode never reach the handler — the row is only hidden.
 */
@Injectable()
export class StaffAuditInterceptor implements NestInterceptor {
  constructor(private readonly audit: StaffAuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();
    const ctx = RequestContext.get();
    const req = context.switchToHttp().getRequest();
    const method = String(req.method || '').toUpperCase();
    if (!ctx?.isStaff || !ctx.module || ['GET', 'HEAD', 'OPTIONS'].includes(method)) {
      return next.handle();
    }

    const target = resolveTarget(ctx.path || '');
    const isDelete = method === 'DELETE';

    if (isDelete && ctx.deleteMode === 'hide' && target.id && HIDEABLE.includes(target.type)) {
      return from(this.audit.hide(ctx, target.type, target.id, method));
    }

    return from(this.audit.snapshot(target.type, target.id)).pipe(
      switchMap((before) =>
        next.handle().pipe(
          mergeMap((result: any) => {
            const entityId = target.id || (result && typeof result.id === 'string' ? result.id : null);
            const action = isDelete ? 'DELETE' : target.id ? 'UPDATE' : 'CREATE';
            const work = (async () => {
              const after = isDelete ? null : await this.audit.snapshot(target.type, entityId);
              await this.audit.record({
                ctx,
                action,
                type: target.type,
                entityId,
                method,
                before,
                after,
              });
            })();
            return from(work.then(() => result, () => result));
          }),
        ),
      ),
    );
  }
}
