import { validateEnvironment } from './environment';

describe('validateEnvironment', () => {
  it('provides safe local defaults', () => {
    expect(validateEnvironment({})).toEqual({
      CORS_ORIGIN: 'http://localhost:5173',
      NODE_ENV: 'development',
      PORT: 3000,
    });
  });

  it('coerces a valid port', () => {
    expect(
      validateEnvironment({
        CORS_ORIGIN: 'https://example.com',
        NODE_ENV: 'production',
        PAYMENTS_TABLE_NAME: 'product-payment-production',
        PORT: '8080',
      }),
    ).toEqual({
      CORS_ORIGIN: 'https://example.com',
      NODE_ENV: 'production',
      PAYMENTS_TABLE_NAME: 'product-payment-production',
      PORT: 8080,
    });
  });

  it('rejects invalid configuration', () => {
    expect(() =>
      validateEnvironment({
        CORS_ORIGIN: 'not-a-url',
        PORT: 'invalid',
      }),
    ).toThrow();
  });

  it('requires the DynamoDB table in production', () => {
    expect(() =>
      validateEnvironment({
        NODE_ENV: 'production',
      }),
    ).toThrow('PAYMENTS_TABLE_NAME is required in production');
  });
});
