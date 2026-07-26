import type { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApplication } from './configure-application';

export async function createApplication<
  TApplication extends INestApplication = INestApplication,
>(): Promise<TApplication> {
  const app = await NestFactory.create<TApplication>(AppModule);

  configureApplication(app);
  await app.init();

  return app;
}
