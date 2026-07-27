import { Product } from '../domain/product';
import { Transaction } from '../domain/transaction';
import { InMemoryCheckoutRepository } from '../infrastructure/in-memory-checkout.repository';
import { GetPaymentConfigurationUseCase } from './get-payment-configuration.use-case';
import { StartPaymentUseCase } from './start-payment.use-case';
import { SyncPaymentUseCase } from './sync-payment.use-case';
import { TransactionNotFoundError } from './checkout.errors';

describe('payment use cases', () => {
  const repository = new InMemoryCheckoutRepository();
  const gateway = {
    getConfiguration: jest.fn(),
    createPayment: jest.fn(),
    getPayment: jest.fn(),
  };
  const getConfiguration = new GetPaymentConfigurationUseCase(gateway);
  const start = new StartPaymentUseCase(repository, gateway);
  const sync = new SyncPaymentUseCase(repository, gateway);

  beforeAll(async () => {
    const product = Product.restore({
      id: 'product-1',
      name: 'Product',
      description: 'Description',
      priceInCents: 10_000,
      stock: 3,
    });
    await repository.seedProduct(product);
    await repository.createPending({
      idempotencyKey: 'checkout-attempt-0001',
      requestFingerprint: 'fingerprint',
      product,
      transaction: Transaction.createPending({
        id: 'transaction-1',
        productId: 'product-1',
        customerId: 'customer-1',
        quantity: 1,
        unitPriceInCents: 10_000,
        createdAt: '2026-07-26T00:00:00.000Z',
      }),
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
  });

  beforeEach(() => jest.clearAllMocks());

  it('delegates public configuration to the gateway', async () => {
    gateway.getConfiguration.mockResolvedValueOnce({ publicKey: 'pub_test' });
    await expect(getConfiguration.execute()).resolves.toEqual({
      publicKey: 'pub_test',
    });
  });

  it('starts, synchronizes and finalizes an approved payment once', async () => {
    gateway.createPayment.mockResolvedValueOnce({
      id: 'wompi-1',
      status: 'PENDING',
    });
    gateway.getPayment.mockResolvedValueOnce({
      id: 'wompi-1',
      status: 'APPROVED',
    });
    const command = {
      transactionId: 'transaction-1',
      paymentToken: 'tok_test_123',
      acceptanceToken: 'acceptance-token',
      personalDataToken: 'personal-token',
    };

    await expect(start.execute(command)).resolves.toMatchObject({
      providerTransactionId: 'wompi-1',
      status: 'PENDING',
    });
    await expect(start.execute(command)).resolves.toMatchObject({
      providerTransactionId: 'wompi-1',
    });
    await expect(sync.execute('transaction-1')).resolves.toMatchObject({
      status: 'APPROVED',
    });
    await expect(sync.execute('transaction-1')).resolves.toMatchObject({
      status: 'APPROVED',
    });

    expect(gateway.createPayment).toHaveBeenCalledTimes(1);
    expect(gateway.getPayment).toHaveBeenCalledTimes(1);
    expect(
      (await repository.findProduct('product-1'))?.toSnapshot().stock,
    ).toBe(2);
  });

  it('rejects unknown transactions', async () => {
    await expect(
      start.execute({
        transactionId: 'missing',
        paymentToken: 'tok_test_123',
        acceptanceToken: 'acceptance-token',
        personalDataToken: 'personal-token',
      }),
    ).rejects.toBeInstanceOf(TransactionNotFoundError);
    await expect(sync.execute('missing')).rejects.toBeInstanceOf(
      TransactionNotFoundError,
    );
  });
});
