import { createRequire } from 'node:module';

process.env.NODE_ENV = 'test';
delete process.env.PAYMENTS_TABLE_NAME;

const require = createRequire(import.meta.url);
const { handler } = require('../.aws-sam/build/ApiFunction/lambda.js');

const expectedPaths = [
  '/api/v1/health',
  '/api/v1/payments/config',
  '/api/v1/products/{productId}',
  '/api/v1/transactions',
  '/api/v1/transactions/{transactionId}',
  '/api/v1/transactions/{transactionId}/payment',
  '/api/v1/transactions/{transactionId}/payment/status',
];

function createEvent(path) {
  return {
    version: '2.0',
    routeKey: 'ANY /{proxy+}',
    rawPath: path,
    rawQueryString: '',
    headers: { host: 'localhost' },
    requestContext: {
      accountId: '',
      apiId: '',
      domainName: 'localhost',
      domainPrefix: 'localhost',
      http: {
        method: 'GET',
        path,
        protocol: 'HTTP/1.1',
        sourceIp: '127.0.0.1',
        userAgent: 'bundle-check',
      },
      requestId: 'bundle-check',
      routeKey: 'ANY /{proxy+}',
      stage: '$default',
      time: '',
      timeEpoch: 0,
    },
    isBase64Encoded: false,
  };
}

async function get(path) {
  const response = await handler(createEvent(path), {});
  if (response.statusCode !== 200) {
    throw new Error(`${path} returned ${response.statusCode}`);
  }
  return response;
}

const documentResponse = await get('/docs-json');
const document = JSON.parse(documentResponse.body);

for (const path of expectedPaths) {
  if (document.paths[path] === undefined) {
    throw new Error(`OpenAPI path is missing: ${path}`);
  }
}

const initializerResponse = await get('/docs/swagger-ui-init.js');
const contentType = initializerResponse.headers?.['content-type'] ?? '';
if (
  !contentType.includes('javascript') ||
  !initializerResponse.body.includes('SwaggerUIBundle')
) {
  throw new Error('Swagger UI initializer is invalid');
}

console.log('Bundled Swagger document is valid');
