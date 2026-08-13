import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { configureApp } from './bootstrap';
import { SWAGGER_UI_CDN_BASE } from './swagger.constants';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  configureApp(app);

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Vehicle Tracking & Telematics API')
    .setDescription(
      'REST and WebSocket API for tracking a vehicle via a GPS-enabled device, ' +
        'detecting trips, geofences, and alerts.',
    )
    .setVersion('1.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'user-jwt',
    )
    .addApiKey(
      {
        type: 'apiKey',
        in: 'header',
        name: 'Authorization',
        description: 'Device <token>',
      },
      'device-token',
    )
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);

  SwaggerModule.setup('api/docs', app, document, {
    customCssUrl: `${SWAGGER_UI_CDN_BASE}/swagger-ui.css`,
    customJs: [
      `${SWAGGER_UI_CDN_BASE}/swagger-ui-bundle.js`,
      `${SWAGGER_UI_CDN_BASE}/swagger-ui-standalone-preset.js`,
    ],
    customfavIcon: `${SWAGGER_UI_CDN_BASE}/favicon-32x32.png`,
  });

  const port = config.get<number>('app.port', 3000);
  await app.listen(port);
}

void bootstrap();