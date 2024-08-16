import { HttpStatus } from '@nestjs/common';
import { ErrorCode } from './error-code';

export class BaseException extends Error {
  public statusCode: HttpStatus;

  public errorCode: ErrorCode;

  public constructor(
    statusCode: HttpStatus,
    errorCode: ErrorCode,
    message: string,
  ) {
    super(message);

    Object.setPrototypeOf(this, new.target.prototype);

    this.statusCode = statusCode;
    this.errorCode = errorCode;

    Error.captureStackTrace(this);
  }
}
