import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ErrorCode } from '../constants/error-codes';
import { ApiErrorResponse } from '../types/api-response.type';

// Plain number, not HttpStatus.INTERNAL_SERVER_ERROR: avoids
// @typescript-eslint/no-unsafe-enum-comparison against `status: number`.
const SERVER_ERROR_THRESHOLD = 500;

const STATUS_TO_CODE: Partial<Record<number, ErrorCode>> = {
  [HttpStatus.BAD_REQUEST]: ErrorCode.VALIDATION_ERROR,
  [HttpStatus.UNAUTHORIZED]: ErrorCode.UNAUTHORIZED,
  [HttpStatus.FORBIDDEN]: ErrorCode.FORBIDDEN,
  [HttpStatus.NOT_FOUND]: ErrorCode.NOT_FOUND,
  [HttpStatus.CONFLICT]: ErrorCode.CONFLICT,
};

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionsHandler');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const { status, code, message } = this.resolve(exception);

    if (status >= SERVER_ERROR_THRESHOLD) {
      this.logger.error(
        `${request.method} ${request.url} -> ${status}: ${message}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    const body: ApiErrorResponse = { success: false, error: { code, message } };
    response.status(status).json(body);
  }

  private resolve(exception: unknown): {
    status: number;
    code: string;
    message: string;
  } {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const payload = exception.getResponse();

      if (this.hasErrorCode(payload)) {
        return { status, code: payload.code, message: payload.message };
      }

      const message = this.extractMessage(payload) ?? exception.message;
      const code = STATUS_TO_CODE[status] ?? ErrorCode.INTERNAL_ERROR;
      return { status, code, message };
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      code: ErrorCode.INTERNAL_ERROR,
      message: 'An unexpected error occurred',
    };
  }

  private hasErrorCode(
    payload: unknown,
  ): payload is { code: string; message: string } {
    return (
      typeof payload === 'object' &&
      payload !== null &&
      'code' in payload &&
      'message' in payload
    );
  }

  private extractMessage(payload: unknown): string | undefined {
    if (typeof payload === 'string') {
      return payload;
    }
    if (
      typeof payload === 'object' &&
      payload !== null &&
      'message' in payload
    ) {
      const { message } = payload;
      return Array.isArray(message) ? message.join('; ') : String(message);
    }
    return undefined;
  }
}
