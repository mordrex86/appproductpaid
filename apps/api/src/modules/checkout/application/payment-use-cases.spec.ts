import { Product } from '../domain/product';
import { Transaction } from '../domain/transaction';
import { InMemoryCheckoutRepository } from '../infrastructure/in-memory-checkout.repository';
import { GetPaymentConfigurationUseCase } from './get-payment-configuration.use-case';
import { StartPaymentUseCase } from './start-payment.use-case';
import { SyncPaymentUseCase } from './sync-payment.use-case';
import {
  PaymentProviderError,
  TransactionNotFoundError,
} from './checkout.errors';
import type { Result } from './result';

async function unwrap<T>(promise: Promise<Result<T, unknown>>): Promise<T> {
  const result = await promise;
  if (!result.ok) throw result.error;
  return result.value;
}

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
    await expect(unwrap(getConfiguration.execute())).resolves.toEqual({
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

    await expect(unwrap(start.execute(command))).resolves.toMatchObject({
      providerTransactionId: 'wompi-1',
      status: 'PENDING',
    });
    await expect(unwrap(start.execute(command))).resolves.toMatchObject({
      providerTransactionId: 'wompi-1',
    });
    await expect(unwrap(sync.execute('transaction-1'))).resolves.toMatchObject({
      status: 'APPROVED',
    });
    await expect(unwrap(sync.execute('transaction-1'))).resolves.toMatchObject({
      status: 'APPROVED',
    });

    expect(gateway.createPayment).toHaveBeenCalledTimes(1);
    expect(gateway.getPayment).toHaveBeenCalledTimes(1);
    expect(
      (await repository.findProduct('product-1'))?.toSnapshot().stock,
    ).toBe(2);
  });

  it('rejects unknown transactions', async () => {
    const startResult = await start.execute({
      transactionId: 'missing',
      paymentToken: 'tok_test_123',
      acceptanceToken: 'acceptance-token',
      personalDataToken: 'personal-token',
    });
    expect(startResult.ok).toBe(false);
    if (startResult.ok) throw new Error('Expected a missing transaction');
    expect(startResult.error).toBeInstanceOf(TransactionNotFoundError);

    const syncResult = await sync.execute('missing');
    expect(syncResult.ok).toBe(false);
    if (syncResult.ok) throw new Error('Expected a missing transaction');
    expect(syncResult.error).toBeInstanceOf(TransactionNotFoundError);
  });

  it('allows only one concurrent request to create the provider payment', async () => {
    const concurrentRepository = new InMemoryCheckoutRepository();
    const concurrentGateway = {
      getConfiguration: jest.fn(),
      createPayment: jest.fn(),
      getPayment: jest.fn(),
    };
    const product = Product.restore({
      id: 'concurrent-product',
      name: 'Product',
      description: 'Description',
      priceInCents: 10_000,
      stock: 1,
    });
    const transaction = Transaction.createPending({
      id: 'concurrent-transaction',
      productId: 'concurrent-product',
      customerId: 'customer-2',
      quantity: 1,
      unitPriceInCents: 10_000,
      createdAt: '2026-07-26T00:00:00.000Z',
    });
    await concurrentRepository.seedProduct(product);
    await concurrentRepository.createPending({
      idempotencyKey: 'checkout-attempt-0002',
      requestFingerprint: 'fingerprint-2',
      product,
      transaction,
      customer: {
        id: 'customer-2',
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

    let completePayment!: (value: { id: string; status: 'PENDING' }) => void;
    concurrentGateway.createPayment.mockReturnValueOnce(
      new Promise((resolve) => {
        completePayment = resolve;
      }),
    );
    const useCase = new StartPaymentUseCase(
      concurrentRepository,
      concurrentGateway,
    );
    const command = {
      transactionId: 'concurrent-transaction',
      paymentToken: 'tok_test_123',
      acceptanceToken: 'acceptance-token',
      personalDataToken: 'personal-token',
    };

    const first = unwrap(useCase.execute(command));
    await Promise.resolve();
    await expect(unwrap(useCase.execute(command))).resolves.toMatchObject({
      status: 'PENDING',
    });
    completePayment({ id: 'wompi-concurrent', status: 'PENDING' });
    await expect(first).resolves.toMatchObject({
      providerTransactionId: 'wompi-concurrent',
    });

    expect(concurrentGateway.createPayment).toHaveBeenCalledTimes(1);
  });

  it('releases reserved stock when the provider request fails', async () => {
    const declinedRepository = new InMemoryCheckoutRepository();
    const declinedGateway = {
      getConfiguration: jest.fn(),
      createPayment: jest
        .fn()
        .mockRejectedValue(new PaymentProviderError('Provider unavailable')),
      getPayment: jest.fn(),
    };
    const product = Product.restore({
      id: 'declined-product',
      name: 'Product',
      description: 'Description',
      priceInCents: 10_000,
      stock: 1,
    });
    await declinedRepository.seedProduct(product);
    await declinedRepository.createPending({
      idempotencyKey: 'checkout-attempt-0003',
      requestFingerprint: 'fingerprint-3',
      product,
      transaction: Transaction.createPending({
        id: 'declined-transaction',
        productId: 'declined-product',
        customerId: 'customer-3',
        quantity: 1,
        unitPriceInCents: 10_000,
        createdAt: '2026-07-26T00:00:00.000Z',
      }),
      customer: {
        id: 'customer-3',
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
    expect(
      (await declinedRepository.findProduct('declined-product'))?.toSnapshot()
        .stock,
    ).toBe(1);

    const result = await new StartPaymentUseCase(
      declinedRepository,
      declinedGateway,
    ).execute({
      transactionId: 'declined-transaction',
      paymentToken: 'tok_test_123',
      acceptanceToken: 'acceptance-token',
      personalDataToken: 'personal-token',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(PaymentProviderError);
    }

    expect(
      (await declinedRepository.findProduct('declined-product'))?.toSnapshot()
        .stock,
    ).toBe(1);
  });
});
