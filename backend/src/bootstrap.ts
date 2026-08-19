import compression from 'compression';
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
import { SWAGGER_UI_CDN_ORIGIN } from './swagger.constants';

/**
 * Shared app configuration between the real bootstrap (main.ts) and e2e
 * tests, so a test exercises the same prefix/versioning/pipes/filters a
 * real request would hit instead of a hand-rolled approximation of them.
 */
export function configureApp(app: INestApplication): void {
  const config = app.get(ConfigService);

  // Every response is re-sent in full (see the no-store Cache-Control
  // below), so compressing the payload directly cuts per-request latency
  // and bandwidth under load — a cheap, safe throughput win.
  app.use(compression());

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

  // Swagger UI's JS/CSS are loaded from a CDN (see main.ts) rather than
  // served from disk, because Vercel's serverless build only bundles files
  // that are actually require()'d/imported — express.static's runtime
  // filesystem scan of node_modules/swagger-ui-dist is invisible to it, so
  // those assets get pruned and 404 in production. helmet's default CSP
  // only allows script-src 'self', which would otherwise block the CDN.
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          ...helmet.contentSecurityPolicy.getDefaultDirectives(),
          'script-src': ["'self'", SWAGGER_UI_CDN_ORIGIN],
        },
      },
    }),
  );
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
