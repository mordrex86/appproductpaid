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
    const { useCase } = await setup();

    await expect(useCase.execute(command)).resolves.toMatchObject({
      productId: 'product-1',
      quantity: 2,
      status: 'PENDING',
      amounts: {
        product: 20_000,
        baseFee: 200_000,
        deliveryFee: 800_000,
        total: 1_020_000,
      },
    });
  });

  it('returns the same transaction for an identical retry', async () => {
    const { useCase } = await setup();

    const first = await useCase.execute(command);
    const retry = await useCase.execute(command);

    expect(retry.id).toBe(first.id);
  });

  it('rejects reuse of the key with a different request', async () => {
    const { useCase } = await setup();
    await useCase.execute(command);

    await expect(
      useCase.execute({ ...command, quantity: 1 }),
    ).rejects.toBeInstanceOf(IdempotencyConflictError);
  });

  it('rejects missing products and insufficient stock', async () => {
    const { useCase } = await setup(1);

    await expect(
      useCase.execute({ ...command, productId: 'missing' }),
    ).rejects.toBeInstanceOf(ProductNotFoundError);
    await expect(useCase.execute(command)).rejects.toBeInstanceOf(
      InsufficientStockError,
    );
  });
});
