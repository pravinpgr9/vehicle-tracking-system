import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { AuthenticatedDevice } from '../guards/device-auth.guard';

export const CurrentDevice = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedDevice => {
    const request = ctx
      .switchToHttp()
      .getRequest<Request & { device: AuthenticatedDevice }>();
    return request.device;
  },
);
