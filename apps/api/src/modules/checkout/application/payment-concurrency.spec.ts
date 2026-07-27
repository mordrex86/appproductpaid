import { Product } from '../domain/product';
import { Transaction } from '../domain/transaction';
import { InMemoryCheckoutRepository } from '../infrastructure/in-memory-checkout.repository';
import { InsufficientStockError } from './checkout.errors';
import { StartPaymentUseCase } from './start-payment.use-case';

describe('payment inventory concurrency', () => {
  it('accepts 12 of 20 simultaneous payments when stock is 12', async () => {
    const repository = new InMemoryCheckoutRepository();
    const gateway = {
      getConfiguration: jest.fn(),
      createPayment: jest.fn(({ reference }: { reference: string }) =>
        Promise.resolve({
          id: `provider-${reference}`,
          status: 'PENDING' as const,
        }),
      ),
      getPayment: jest.fn(),
    };
    const product = Product.restore({
      id: 'limited-product',
      name: 'Product',
      description: 'Description',
      priceInCents: 129_900,
      stock: 12,
    });
    await repository.seedProduct(product);

    const transactionIds = Array.from(
      { length: 20 },
      (_, index) => `transaction-${index + 1}`,
    );
    await Promise.all(
      transactionIds.map((id, index) =>
        repository.createPending({
          idempotencyKey: `attempt-${index + 1}`,
          requestFingerprint: `fingerprint-${index + 1}`,
          product,
          transaction: Transaction.createPending({
            id,
            productId: 'limited-product',
            customerId: `customer-${index + 1}`,
            quantity: 1,
            unitPriceInCents: 129_900,
            createdAt: '2026-07-27T00:00:00.000Z',
          }),
          customer: {
            id: `customer-${index + 1}`,
            fullName: 'Cliente',
            email: `cliente${index + 1}@example.com`,
            phone: '+573001234567',
          },
          delivery: {
            addressLine: 'Calle 10 # 20-30',
            city: 'Bogotá',
            region: 'Cundinamarca',
            postalCode: '110111',
          },
        }),
      ),
    );

    const results = await Promise.all(
      transactionIds.map((transactionId) =>
        new StartPaymentUseCase(repository, gateway).execute({
          transactionId,
          paymentToken: 'tok_test_123',
          acceptanceToken: 'acceptance-token',
          personalDataToken: 'personal-token',
        }),
      ),
    );

    expect(results.filter((result) => result.ok)).toHaveLength(12);
    expect(
      results.filter(
        (result) =>
          !result.ok && result.error instanceof InsufficientStockError,
      ),
    ).toHaveLength(8);
    expect(gateway.createPayment).toHaveBeenCalledTimes(12);
    expect(
      (await repository.findProduct('limited-product'))?.toSnapshot().stock,
    ).toBe(0);
  });

  it('reclaims an expired payment lease without consuming stock twice', async () => {
    let now = 0;
    const repository = new InMemoryCheckoutRepository(() => now, 60_000);
    const product = Product.restore({
      id: 'leased-product',
      name: 'Product',
      description: 'Description',
      priceInCents: 129_900,
      stock: 1,
    });
    const transaction = Transaction.createPending({
      id: 'leased-transaction',
      productId: 'leased-product',
      customerId: 'customer-1',
      quantity: 1,
      unitPriceInCents: 129_900,
      createdAt: '2026-07-27T00:00:00.000Z',
    });
    await repository.seedProduct(product);
    await repository.createPending({
      idempotencyKey: 'leased-attempt',
      requestFingerprint: 'leased-fingerprint',
      product,
      transaction,
      customer: {
        id: 'customer-1',
        fullName: 'Cliente',
        email: 'cliente@example.com',
        phone: '+573001234567',
      },
      delivery: {
        addressLine: 'Calle 10 # 20-30',
        city: 'Bogotá',
        region: 'Cundinamarca',
        postalCode: '110111',
      },
    });

    await expect(repository.claimPayment(transaction)).resolves.toBe(true);
    now = 59_999;
    await expect(repository.claimPayment(transaction)).resolves.toBe(false);
    now = 60_000;
    await expect(repository.claimPayment(transaction)).resolves.toBe(true);
    expect(
      (await repository.findProduct('leased-product'))?.toSnapshot().stock,
    ).toBe(0);
  });
});
