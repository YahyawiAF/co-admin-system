import { HttpException, HttpStatus } from '@nestjs/common';

export class GeneralException extends HttpException {
  constructor(
    statusCode: HttpStatus,
    public readonly errorCode: string,
    message: string,
  ) {
    super({ statusCode, errorCode, message }, statusCode);

    Object.setPrototypeOf(this, new.target.prototype);
  }
}
