import { HttpException, HttpStatus } from '@nestjs/common';
import { ErrorCode } from '../constants/error-codes';

export class AppException extends HttpException {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    status: HttpStatus = HttpStatus.BAD_REQUEST,
  ) {
    super({ code, message }, status);
  }
}
