const { NestFactory } = require('@nestjs/core');
const serverless = require('serverless-http');

const { AppModule } = require('../../dist/app.module');
const { configureApp } = require('../../dist/bootstrap');

let cachedHandler;

async function bootstrap() {
  if (cachedHandler) {
    return cachedHandler;
  }

  const app = await NestFactory.create(AppModule);

  configureApp(app);

  await app.init();

  const expressApp = app.getHttpAdapter().getInstance();

  cachedHandler = serverless(expressApp);

  return cachedHandler;
}

exports.handler = async (event, context) => {
  const handler = await bootstrap();

  return handler(event, context);
};