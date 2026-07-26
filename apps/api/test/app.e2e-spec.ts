import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { z } from 'zod';
import { createApplication } from './../src/create-application';

const openApiDocumentSchema = z.object({
  info: z.object({
    title: z.string(),
    version: z.string(),
  }),
  paths: z.record(z.string(), z.unknown()),
});

describe('HealthController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    app = await createApplication<INestApplication<App>>();
  });

  it('/api/v1/health (GET)', () => {
    return request(app.getHttpServer())
      .get('/api/v1/health')
      .expect(200)
      .expect({
        status: 'ok',
      });
  });

  it('/docs-json (GET)', async () => {
    const response = await request(app.getHttpServer())
      .get('/docs-json')
      .expect(200);
    const document = openApiDocumentSchema.parse(response.body as unknown);

    expect(document.info).toMatchObject({
      title: 'Product payment API',
      version: '1.0',
    });
    expect(document.paths).toHaveProperty('/api/v1/health');
  });

  afterEach(async () => {
    await app.close();
  });
});
