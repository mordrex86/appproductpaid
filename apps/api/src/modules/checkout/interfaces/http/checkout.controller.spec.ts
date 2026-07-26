import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import {
  IdempotencyConflictError,
  InsufficientStockError,
  ProductNotFoundError,
  TransactionNotFoundError,
} from '../../application/checkout.errors';
import type { CreatePendingTransactionUseCase } from '../../application/create-pending-transaction.use-case';
import type { GetProductUseCase } from '../../application/get-product.use-case';
import type { GetTransactionUseCase } from '../../application/get-transaction.use-case';
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
  const controller = new CheckoutController(
    getProduct as unknown as GetProductUseCase,
    createPending as unknown as CreatePendingTransactionUseCase,
    getTransaction as unknown as GetTransactionUseCase,
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
