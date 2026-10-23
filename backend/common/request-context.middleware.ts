import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { RequestContext } from './request-context';

/** Opens a fresh request context so guards and Prisma middleware can share it. */
@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  use(_req: Request, _res: Response, next: NextFunction) {
    RequestContext.run(() => next());
  }
}
