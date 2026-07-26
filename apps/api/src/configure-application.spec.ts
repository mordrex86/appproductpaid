import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { z } from 'zod';
import { createApplication } from './create-application';

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
    app = await createApplication<INestApplication<App>>();
  });

  afterAll(async () => {
    await app.close();
  });

  it('serves the Swagger UI', async () => {
    const response = await request(app.getHttpServer())
      .get('/docs/')
      .expect('content-type', /html/)
      .expect(200);

    expect(response.headers).toMatchObject({
      'x-content-type-options': 'nosniff',
    });
    expect(response.headers).not.toHaveProperty('x-powered-by');
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
