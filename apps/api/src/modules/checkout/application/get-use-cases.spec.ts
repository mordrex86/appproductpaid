import { GetProductUseCase } from './get-product.use-case';
import { GetTransactionUseCase } from './get-transaction.use-case';
import {
  ProductNotFoundError,
  TransactionNotFoundError,
} from './checkout.errors';
import { InMemoryCheckoutRepository } from '../infrastructure/in-memory-checkout.repository';
import { Product } from '../domain/product';

describe('checkout queries', () => {
  it('returns a product and maps a missing product', async () => {
    const repository = new InMemoryCheckoutRepository();
    const product = Product.restore({
      id: 'product-1',
      name: 'Product',
      description: 'Description',
      priceInCents: 10_000,
      stock: 2,
    });
    await repository.seedProduct(product);
    await repository.seedProduct(
      Product.restore({
        ...product.toSnapshot(),
        stock: 99,
      }),
    );
    const useCase = new GetProductUseCase(repository);

    await expect(useCase.execute('product-1')).resolves.toEqual({
      ok: true,
      value: product.toSnapshot(),
    });
    const missing = await useCase.execute('missing');
    expect(missing.ok).toBe(false);
    if (missing.ok) throw new Error('Expected a missing product');
    expect(missing.error).toBeInstanceOf(ProductNotFoundError);
  });

  it('maps a missing transaction', async () => {
    const useCase = new GetTransactionUseCase(new InMemoryCheckoutRepository());

    const missing = await useCase.execute('missing');
    expect(missing.ok).toBe(false);
    if (missing.ok) throw new Error('Expected a missing transaction');
    expect(missing.error).toBeInstanceOf(TransactionNotFoundError);
  });
});
