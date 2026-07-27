import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { SELF_DECLARED_DEPS_METADATA } from '@nestjs/common/constants';
import {
  IdempotencyConflictError,
  InsufficientStockError,
  PaymentConfigurationError,
  PaymentProviderError,
  ProductNotFoundError,
  TransactionNotFoundError,
} from '../../application/checkout.errors';
import { CreatePendingTransactionUseCase } from '../../application/create-pending-transaction.use-case';
import { GetProductUseCase } from '../../application/get-product.use-case';
import { GetTransactionUseCase } from '../../application/get-transaction.use-case';
import { GetPaymentConfigurationUseCase } from '../../application/get-payment-configuration.use-case';
import { StartPaymentUseCase } from '../../application/start-payment.use-case';
import { SyncPaymentUseCase } from '../../application/sync-payment.use-case';
import type { CreatePendingTransactionDto } from './checkout.dto';
import { CheckoutController } from './checkout.controller';

describe('CheckoutController', () => {
  const getProduct = {
    execute: jest.fn(),
  };
  const createPending = {
    execute: jest.fn(),
  };
  const getTransaction = {
    execute: jest.fn(),
  };
  const getPaymentConfiguration = { execute: jest.fn() };
  const startPayment = { execute: jest.fn() };
  const syncPayment = { execute: jest.fn() };
  const controller = new CheckoutController(
    getProduct as unknown as GetProductUseCase,
    createPending as unknown as CreatePendingTransactionUseCase,
    getTransaction as unknown as GetTransactionUseCase,
    getPaymentConfiguration as unknown as GetPaymentConfigurationUseCase,
    startPayment as unknown as StartPaymentUseCase,
    syncPayment as unknown as SyncPaymentUseCase,
  );
  const body: CreatePendingTransactionDto = {
    productId: 'product-1',
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
  };

  it('declares its dependencies for bundled Lambda builds', () => {
    expect(
      Reflect.getMetadata(SELF_DECLARED_DEPS_METADATA, CheckoutController),
    ).toEqual(
      expect.arrayContaining([
        { index: 0, param: GetProductUseCase },
        { index: 1, param: CreatePendingTransactionUseCase },
        { index: 2, param: GetTransactionUseCase },
        { index: 3, param: GetPaymentConfigurationUseCase },
        { index: 4, param: StartPaymentUseCase },
        { index: 5, param: SyncPaymentUseCase },
      ]),
    );
  });

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('returns products and transactions', async () => {
    getProduct.execute.mockResolvedValueOnce({ id: 'product-1' });
    getTransaction.execute.mockResolvedValueOnce({ id: 'transaction-1' });

    await expect(controller.findProduct('product-1')).resolves.toEqual({
      id: 'product-1',
    });
    await expect(controller.findTransaction('transaction-1')).resolves.toEqual({
      id: 'transaction-1',
    });
  });

  it('creates a pending transaction with a valid key', async () => {
    createPending.execute.mockResolvedValueOnce({ id: 'transaction-1' });

    await expect(
      controller.createTransaction('checkout-attempt-0001', body),
    ).resolves.toEqual({ id: 'transaction-1' });
  });

  it('gets payment configuration, starts and synchronizes payments', async () => {
    getPaymentConfiguration.execute.mockResolvedValueOnce({
      publicKey: 'pub_test',
    });
    startPayment.execute.mockResolvedValueOnce({ status: 'PENDING' });
    syncPayment.execute.mockResolvedValueOnce({ status: 'APPROVED' });

    await expect(controller.paymentConfiguration()).resolves.toEqual({
      publicKey: 'pub_test',
    });
    await expect(
      controller.pay('transaction-1', {
        paymentToken: 'tok_test_123',
        acceptanceToken: 'acceptance-token',
        personalDataToken: 'personal-token',
      }),
    ).resolves.toEqual({ status: 'PENDING' });
    await expect(controller.sync('transaction-1')).resolves.toEqual({
      status: 'APPROVED',
    });
  });

  it.each([
    [new TransactionNotFoundError(), NotFoundException],
    [new PaymentConfigurationError(), ServiceUnavailableException],
    [new PaymentProviderError(), ServiceUnavailableException],
    [new InsufficientStockError(), ConflictException],
  ])('maps expected payment errors', async (error, expected) => {
    startPayment.execute.mockRejectedValueOnce(error);
    await expect(
      controller.pay('transaction-1', {
        paymentToken: 'tok_test_123',
        acceptanceToken: 'acceptance-token',
        personalDataToken: 'personal-token',
      }),
    ).rejects.toBeInstanceOf(expected);
  });

  it('rejects missing or malformed idempotency keys', async () => {
    await expect(
      controller.createTransaction(undefined, body),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      controller.createTransaction('unsafe key value', body),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it.each([
    [new ProductNotFoundError(), NotFoundException],
    [new InsufficientStockError(), ConflictException],
    [new IdempotencyConflictError(), ConflictException],
  ])('maps expected create errors', async (error, expected) => {
    createPending.execute.mockRejectedValueOnce(error);

    await expect(
      controller.createTransaction('checkout-attempt-0001', body),
    ).rejects.toBeInstanceOf(expected);
  });

  it('maps missing resources and rethrows unexpected failures', async () => {
    getProduct.execute.mockRejectedValueOnce(new ProductNotFoundError());
    await expect(controller.findProduct('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );

    getTransaction.execute.mockRejectedValueOnce(
      new TransactionNotFoundError(),
    );
    await expect(controller.findTransaction('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );

    const unexpected = new Error('unexpected');
    getProduct.execute.mockRejectedValueOnce(unexpected);
    await expect(controller.findProduct('product-1')).rejects.toBe(unexpected);
    createPending.execute.mockRejectedValueOnce(unexpected);
    await expect(
      controller.createTransaction('checkout-attempt-0001', body),
    ).rejects.toBe(unexpected);
    getTransaction.execute.mockRejectedValueOnce(unexpected);
    await expect(controller.findTransaction('transaction-1')).rejects.toBe(
      unexpected,
    );
  });
});
