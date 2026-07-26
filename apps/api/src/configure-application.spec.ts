import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { z } from 'zod';
import { AppModule } from './app.module';
import { configureApplication } from './configure-application';

const openApiDocumentSchema = z.object({
  info: z.object({
    title: z.string(),
    version: z.string(),
  }),
  paths: z.record(z.string(), z.unknown()),
});

describe('configureApplication', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    configureApplication(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('serves the Swagger UI', async () => {
    await request(app.getHttpServer())
      .get('/docs/')
      .expect('content-type', /html/)
      .expect(200);
  });

  it('serves the OpenAPI JSON document', async () => {
    const response = await request(app.getHttpServer())
      .get('/docs-json')
      .expect('content-type', /json/)
      .expect(200);
    const document = openApiDocumentSchema.parse(response.body as unknown);

    expect(document).toMatchObject({
      info: {
        title: 'Product payment API',
        version: '1.0',
      },
    });
    expect(document.paths).toHaveProperty('/api/v1/health');
  });
});
