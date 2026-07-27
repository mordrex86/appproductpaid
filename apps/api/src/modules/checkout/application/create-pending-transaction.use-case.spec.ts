import {
  IdempotencyConflictError,
  InsufficientStockError,
  ProductNotFoundError,
} from './checkout.errors';
import { CreatePendingTransactionUseCase } from './create-pending-transaction.use-case';
import { Product } from '../domain/product';
import { InMemoryCheckoutRepository } from '../infrastructure/in-memory-checkout.repository';

describe('CreatePendingTransactionUseCase', () => {
  const command = {
    idempotencyKey: 'checkout-attempt-0001',
    productId: 'product-1',
    quantity: 2,
    customer: {
      fullName: 'Ana Torres',
      email: 'ANA@EXAMPLE.COM',
      phone: '+573001234567',
    },
    delivery: {
      addressLine: 'Carrera 7 # 80-10',
      city: 'Bogotá',
      region: 'Cundinamarca',
      postalCode: '110221',
    },
  };

  async function setup(stock = 3) {
    const repository = new InMemoryCheckoutRepository();
    await repository.seedProduct(
      Product.restore({
        id: 'product-1',
        name: 'Product',
        description: 'Description',
        priceInCents: 10_000,
        stock,
      }),
    );
    return {
      repository,
      useCase: new CreatePendingTransactionUseCase(repository),
    };
  }

  it('creates a pending transaction and calculates its total', async () => {
    const { repository, useCase } = await setup();

    await expect(useCase.execute(command)).resolves.toMatchObject({
      ok: true,
      value: {
        productId: 'product-1',
        quantity: 2,
        status: 'PENDING',
        amounts: {
          product: 20_000,
          baseFee: 200_000,
          deliveryFee: 800_000,
          total: 1_020_000,
        },
      },
    });
    expect(
      (await repository.findProduct('product-1'))?.toSnapshot().stock,
    ).toBe(3);
  });

  it('returns the same transaction for an identical retry', async () => {
    const { useCase } = await setup();

    const first = await useCase.execute(command);
    const retry = await useCase.execute(command);

    expect(first.ok && retry.ok && retry.value.id).toBe(
      first.ok ? first.value.id : undefined,
    );
  });

  it('rejects reuse of the key with a different request', async () => {
    const { useCase } = await setup();
    await useCase.execute(command);

    const result = await useCase.execute({ ...command, quantity: 1 });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected an idempotency conflict');
    expect(result.error).toBeInstanceOf(IdempotencyConflictError);
  });

  it('rejects missing products and insufficient stock', async () => {
    const { useCase } = await setup(1);

    const missing = await useCase.execute({
      ...command,
      productId: 'missing',
    });
    expect(missing.ok).toBe(false);
    if (missing.ok) throw new Error('Expected a missing product');
    expect(missing.error).toBeInstanceOf(ProductNotFoundError);

    const unavailable = await useCase.execute(command);
    expect(unavailable.ok).toBe(false);
    if (unavailable.ok) throw new Error('Expected unavailable stock');
    expect(unavailable.error).toBeInstanceOf(InsufficientStockError);
  });
});
