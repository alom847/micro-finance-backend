import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import * as cookieParser from 'cookie-parser';

import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './global-exception.filter';
import {
  LOCAL_STORAGE_URL_PREFIX,
  localStorageRoot,
} from './storage/adapters/local-storage.adapter';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.enableCors({
    origin: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });
  app.use(cookieParser());

  if ((process.env.STORAGE_DRIVER || 'aws').toLowerCase() === 'local') {
    // Serve locally stored uploads, e.g. /public/images/<file>
    app.useStaticAssets(localStorageRoot(), {
      prefix: LOCAL_STORAGE_URL_PREFIX,
      index: false,
      dotfiles: 'deny',
    });
  }
  app.setGlobalPrefix('v1/api');
  app.useGlobalPipes(new ValidationPipe());
  app.useGlobalFilters(new GlobalExceptionFilter());
  await app.listen(3000);
}
bootstrap();
