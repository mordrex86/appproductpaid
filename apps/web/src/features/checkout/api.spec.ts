import { createTransaction, getProduct } from './api';

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
      priceInCents: 129_900,
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
});
