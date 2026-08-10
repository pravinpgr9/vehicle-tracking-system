import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Request } from 'express';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiSuccessResponse } from '../types/api-response.type';

/**
 * Wraps every successful controller response in the { success, data }
 * envelope described in the API docs, so error responses (produced by
 * AllExceptionsFilter) are the only shape callers need to branch on.
 *
 * The health check is exempt: monitoring tools expect its documented
 * { status, database, timestamp } shape at the top level, not nested.
 */
@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<
  T,
  T | ApiSuccessResponse<T>
> {
  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<T | ApiSuccessResponse<T>> {
    const request = context.switchToHttp().getRequest<Request>();
    if (request.url.startsWith('/api/health')) {
      return next.handle();
    }
    return next.handle().pipe(
      map((data) =>
        // Leave a 204 No Content (e.g. DELETE) with a genuinely empty body.
        data === undefined ? data : { success: true, data },
      ),
    );
  }
}
