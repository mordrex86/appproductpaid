import { createHash } from 'node:crypto';
import {
  PaymentConfigurationError,
  PaymentProviderError,
} from '../application/checkout.errors';
import { WompiPaymentGateway } from './wompi-payment.gateway';

function response(body: unknown, ok = true): Response {
  return {
    json: jest.fn().mockResolvedValue(body),
    ok,
  } as unknown as Response;
}

describe('WompiPaymentGateway', () => {
  const request = jest.fn<Promise<Response>, Parameters<typeof fetch>>();
  const gateway = new WompiPaymentGateway(
    'https://sandbox.example/v1',
    'pub_test_123',
    'prv_test_123',
    'integrity-test',
    request,
  );

  beforeEach(() => request.mockReset());

  it('returns the public tokenization configuration and agreements', async () => {
    request.mockResolvedValueOnce(
      response({
        data: {
          presigned_acceptance: {
            acceptance_token: 'acceptance-token',
            permalink: 'https://example.com/terms',
          },
          presigned_personal_data_auth: {
            acceptance_token: 'personal-token',
            permalink: 'https://example.com/privacy',
          },
        },
      }),
    );

    await expect(gateway.getConfiguration()).resolves.toEqual({
      publicKey: 'pub_test_123',
      tokenizationUrl: 'https://sandbox.example/v1/tokens/cards',
      terms: {
        acceptanceToken: 'acceptance-token',
        permalink: 'https://example.com/terms',
      },
      personalData: {
        acceptanceToken: 'personal-token',
        permalink: 'https://example.com/privacy',
      },
    });
  });

  it('signs and creates a card payment with the private key', async () => {
    request.mockResolvedValueOnce(
      response({ data: { id: 'wompi-1', status: 'APPROVED' } }),
    );
    const result = await gateway.createPayment({
      reference: 'transaction-1',
      paymentToken: 'tok_test_123',
      acceptanceToken: 'acceptance-token',
      personalDataToken: 'personal-token',
      amounts: {
        product: 12_990_000,
        baseFee: 200_000,
        deliveryFee: 800_000,
        total: 13_990_000,
      },
      customer: {
        id: 'customer-1',
        fullName: 'Laura Medina',
        email: 'laura@example.com',
        phone: '+573001234567',
      },
      delivery: {
        addressLine: 'Calle 10 # 20-30',
        city: 'Bogotá',
        region: 'Cundinamarca',
        postalCode: '110111',
      },
    });

    expect(result).toEqual({ id: 'wompi-1', status: 'APPROVED' });
    const init = request.mock.calls[0]?.[1];
    if (typeof init?.body !== 'string') throw new Error('Expected JSON body');
    const body: unknown = JSON.parse(init.body);
    expect(init?.headers).toMatchObject({
      Authorization: 'Bearer prv_test_123',
    });
    expect(body).toMatchObject({
      signature: createHash('sha256')
        .update('transaction-113990000COPintegrity-test')
        .digest('hex'),
    });
  });

  it.each([
    ['PENDING', 'PENDING'],
    ['DECLINED', 'DECLINED'],
    ['VOIDED', 'DECLINED'],
    ['UNKNOWN', 'ERROR'],
  ])('maps provider status %s to %s', async (providerStatus, expected) => {
    request.mockResolvedValueOnce(
      response({ data: { id: 'wompi-1', status: providerStatus } }),
    );
    await expect(gateway.getPayment('wompi-1')).resolves.toEqual({
      id: 'wompi-1',
      status: expected,
    });
  });

  it('returns safe configuration and provider errors', async () => {
    const missing = new WompiPaymentGateway(
      'https://sandbox.example/v1',
      undefined,
      undefined,
      undefined,
      request,
    );
    await expect(missing.getConfiguration()).rejects.toBeInstanceOf(
      PaymentConfigurationError,
    );

    request.mockResolvedValueOnce(response({ error: {} }, false));
    await expect(gateway.getPayment('wompi-1')).rejects.toBeInstanceOf(
      PaymentProviderError,
    );

    request.mockRejectedValueOnce(new TypeError('network unavailable'));
    await expect(gateway.getPayment('wompi-1')).rejects.toBeInstanceOf(
      PaymentProviderError,
    );
  });
});
