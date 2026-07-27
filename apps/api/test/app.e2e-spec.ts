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
    for (const path of [
      '/api/v1/health',
      '/api/v1/payments/config',
      '/api/v1/products/{productId}',
      '/api/v1/transactions',
      '/api/v1/transactions/{transactionId}',
      '/api/v1/transactions/{transactionId}/payment',
      '/api/v1/transactions/{transactionId}/payment/status',
    ]) {
      expect(document.paths).toHaveProperty(path);
    }

    const productOperation = z
      .object({
        parameters: z.array(
          z.object({
            name: z.string(),
            in: z.string(),
            required: z.boolean(),
          }),
        ),
        responses: z.record(
          z.string(),
          z.object({
            content: z
              .record(
                z.string(),
                z.object({ schema: z.object({ $ref: z.string() }) }),
              )
              .optional(),
          }),
        ),
      })
      .parse(
        z
          .object({ get: z.unknown() })
          .parse(document.paths['/api/v1/products/{productId}']).get,
      );
    expect(productOperation.parameters).toContainEqual(
      expect.objectContaining({
        name: 'productId',
        in: 'path',
        required: true,
      }),
    );
    expect(productOperation.responses['200']?.content).toBeDefined();

    const createOperation = z
      .object({
        requestBody: z.object({
          required: z.boolean(),
          content: z.record(
            z.string(),
            z.object({ schema: z.object({ $ref: z.string() }) }),
          ),
        }),
        responses: z.record(z.string(), z.unknown()),
      })
      .parse(
        z
          .object({ post: z.unknown() })
          .parse(document.paths['/api/v1/transactions']).post,
      );
    expect(createOperation.requestBody.required).toBe(true);
    expect(createOperation.requestBody.content).toHaveProperty(
      'application/json',
    );
    expect(createOperation.responses).toHaveProperty('404');
    expect(createOperation.responses).toHaveProperty('409');

    const paymentOperation = z
      .object({
        requestBody: z.object({ required: z.boolean() }),
        responses: z.record(z.string(), z.unknown()),
      })
      .parse(
        z
          .object({ post: z.unknown() })
          .parse(document.paths['/api/v1/transactions/{transactionId}/payment'])
          .post,
      );
    expect(paymentOperation.requestBody.required).toBe(true);
    expect(paymentOperation.responses).toHaveProperty('400');
    expect(paymentOperation.responses).toHaveProperty('409');
  });

  it('creates and reads a pending transaction', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/products/wireless-headphones')
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          id: 'wireless-headphones',
          priceInCents: 12_990_000,
          stock: 12,
        });
      });

    const response = await request(app.getHttpServer())
      .post('/api/v1/transactions')
      .set('Idempotency-Key', 'checkout-attempt-0001')
      .send({
        productId: 'wireless-headphones',
        quantity: 1,
        customer: {
          fullName: 'Ana Torres',
          email: 'ana@example.com',
          phone: '+573001234567',
        },
        delivery: {
          addressLine: 'Carrera 7 # 80-10',
          city: 'Bogotá',
          region: 'Cundinamarca',
          postalCode: '110221',
        },
      })
      .expect(201);

    expect(response.body).toMatchObject({
      productId: 'wireless-headphones',
      status: 'PENDING',
      amounts: {
        product: 12_990_000,
        baseFee: 200_000,
        deliveryFee: 800_000,
        total: 13_990_000,
      },
    });
    const transactionId = z
      .object({ id: z.string() })
      .parse(response.body as unknown).id;

    await request(app.getHttpServer())
      .get(`/api/v1/transactions/${transactionId}`)
      .expect(200)
      .expect(response.body);
  });

  it('validates requests and maps expected errors', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/products/missing')
      .expect(404)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          code: 'PRODUCT_NOT_FOUND',
        });
      });

    await request(app.getHttpServer())
      .post('/api/v1/transactions')
      .set('Idempotency-Key', 'short')
      .send({
        productId: 'wireless-headphones',
        quantity: 1,
        customer: {
          fullName: 'Ana Torres',
          email: 'ana@example.com',
          phone: '+573001234567',
        },
        delivery: {
          addressLine: 'Carrera 7 # 80-10',
          city: 'Bogotá',
          region: 'Cundinamarca',
          postalCode: '110221',
        },
      })
      .expect(400)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          code: 'INVALID_IDEMPOTENCY_KEY',
        });
      });

    await request(app.getHttpServer())
      .post('/api/v1/transactions')
      .set('Idempotency-Key', 'checkout-attempt-invalid')
      .send({})
      .expect(400)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          code: 'VALIDATION_ERROR',
        });
      });

    await request(app.getHttpServer())
      .get('/api/v1/transactions/missing')
      .expect(404)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          code: 'TRANSACTION_NOT_FOUND',
        });
      });
  });

  afterEach(async () => {
    await app.close();
  });
});
