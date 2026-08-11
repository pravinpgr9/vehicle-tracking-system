import helmet from 'helmet';
import {
  INestApplication,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Express, NextFunction, Request, Response } from 'express';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';

/**
 * Shared app configuration between the real bootstrap (main.ts) and e2e
 * tests, so a test exercises the same prefix/versioning/pipes/filters a
 * real request would hit instead of a hand-rolled approximation of them.
 */
export function configureApp(app: INestApplication): void {
  const config = app.get(ConfigService);

  // Every response here is dynamic and often per-user — a conditional
  // GET revalidating to a bare 304 has broken naive fetch() clients that
  // don't handle it (an empty body isn't valid JSON), and Express enables
  // ETag generation by default. Disabling it removes the failure mode
  // instead of asking every client to defend against it.
  (app.getHttpAdapter().getInstance() as Express).set('etag', false);
  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.set('Cache-Control', 'no-store');
    next();
  });

  app.use(helmet());
  app.enableCors({ origin: config.get<string>('app.corsOrigin') });

  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new ResponseInterceptor());
}
