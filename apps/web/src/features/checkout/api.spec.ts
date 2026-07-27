import {
  createTransaction,
  getPaymentConfiguration,
  getProduct,
  startPayment,
  syncPayment,
  tokenizeCard,
} from './api';

function response(body: unknown, status = 200): Response {
  return {
    json: jest.fn().mockResolvedValue(body),
    ok: status >= 200 && status < 300,
    status,
  } as unknown as Response;
}

describe('checkout API', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('loads the product', async () => {
    const product = {
      id: 'wireless-headphones',
      name: 'Audífonos',
      description: 'Descripción',
      priceInCents: 12_990_000,
      stock: 12,
    };
    jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce(response(product));

    await expect(getProduct()).resolves.toEqual(product);
    expect(fetch).toHaveBeenCalledWith(
      '/api/v1/products/wireless-headphones',
      expect.any(Object),
    );
  });

  it('creates a transaction with its idempotency key', async () => {
    jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(response({ id: 'transaction-1' }, 201));

    await createTransaction({
      idempotencyKey: 'checkout-attempt-0001',
      productId: 'wireless-headphones',
      quantity: 1,
      customer: {
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

    expect(fetch).toHaveBeenCalledWith(
      '/api/v1/transactions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Idempotency-Key': 'checkout-attempt-0001',
        }),
      }),
    );
  });

  it('uses safe API errors and a fallback', async () => {
    jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(response({ message: 'Sin stock' }, 409))
      .mockResolvedValueOnce({
        json: jest.fn().mockRejectedValue(new Error('invalid')),
        ok: false,
        status: 500,
      } as unknown as Response);

    await expect(getProduct()).rejects.toThrow('Sin stock');
    await expect(getProduct()).rejects.toThrow(
      'No fue posible completar la solicitud.',
    );
  });

  it('tokenizes the card without sending it to the application API', async () => {
    jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(response({ data: { id: 'tok_test_123' } }));

    await expect(
      tokenizeCard(
        {
          publicKey: 'pub_test_123',
          tokenizationUrl: 'https://sandbox.example/tokens/cards',
          terms: {
            acceptanceToken: 'acceptance-token',
            permalink: 'https://sandbox.example/terms',
          },
          personalData: {
            acceptanceToken: 'personal-token',
            permalink: 'https://sandbox.example/privacy',
          },
        },
        {
          number: '4242 4242 4242 4242',
          cardholder: 'Laura Medina',
          expiry: '12/29',
          cvc: '123',
        },
      ),
    ).resolves.toBe('tok_test_123');
    expect(fetch).toHaveBeenCalledWith(
      'https://sandbox.example/tokens/cards',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer pub_test_123',
        }),
      }),
    );
  });

  it('does not expose payment provider errors to the customer', async () => {
    jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        response({ error: { reason: 'Invalid private key' } }, 401),
      );

    await expect(
      tokenizeCard(
        {
          publicKey: 'pub_test_123',
          tokenizationUrl: 'https://sandbox.example/tokens/cards',
          terms: {
            acceptanceToken: 'acceptance-token',
            permalink: 'https://sandbox.example/terms',
          },
          personalData: {
            acceptanceToken: 'personal-token',
            permalink: 'https://sandbox.example/privacy',
          },
        },
        {
          number: '4242424242424242',
          cardholder: 'Laura Medina',
          expiry: '12/29',
          cvc: '123',
        },
      ),
    ).rejects.toThrow(
      'No pudimos validar la tarjeta. Revisa los datos e intenta de nuevo.',
    );
  });

  it('loads payment configuration, starts and synchronizes a payment', async () => {
    const configuration = { publicKey: 'pub_test_123' };
    const transaction = { id: 'transaction-1', status: 'PENDING' };
    jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(response(configuration))
      .mockResolvedValueOnce(response(transaction))
      .mockResolvedValueOnce(response(transaction));

    await expect(getPaymentConfiguration()).resolves.toEqual(configuration);
    await startPayment('transaction-1', {
      paymentToken: 'tok_test_123',
      acceptanceToken: 'acceptance-token',
      personalDataToken: 'personal-token',
    });
    await syncPayment('transaction-1');

    expect(fetch).toHaveBeenNthCalledWith(
      2,
      '/api/v1/transactions/transaction-1/payment',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(fetch).toHaveBeenNthCalledWith(
      3,
      '/api/v1/transactions/transaction-1/payment/status',
      expect.objectContaining({ method: 'POST' }),
    );
  });
});
