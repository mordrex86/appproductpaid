import {
  BadRequestException,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';

export function configureApplication(app: INestApplication): void {
  const config = app.get(ConfigService);
  const corsOrigin = config.getOrThrow<string>('CORS_ORIGIN');

  app.setGlobalPrefix('api/v1');
  app.enableCors({
    origin: corsOrigin,
  });
  app.use(
    helmet({
      contentSecurityPolicy: false,
    }),
  );
  app.useGlobalPipes(
    new ValidationPipe({
      exceptionFactory: () =>
        new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed',
        }),
      forbidNonWhitelisted: true,
      transform: true,
      whitelist: true,
    }),
  );

  const openApiConfig = new DocumentBuilder()
    .setTitle('Product payment API')
    .setDescription('API para el flujo de compra, pago y entrega.')
    .setVersion('1.0')
    .addTag('health', 'Disponibilidad de la API')
    .addTag('checkout', 'Producto, cliente, entrega y transacciones')
    .build();
  const documentFactory = () =>
    SwaggerModule.createDocument(app, openApiConfig);

  SwaggerModule.setup('docs', app, documentFactory, {
    customSiteTitle: 'Product payment API documentation',
    jsonDocumentUrl: 'docs-json',
    raw: ['json'],
  });
}
