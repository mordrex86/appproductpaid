import { Product } from './product';

describe('Product', () => {
  const product = () =>
    Product.restore({
      id: 'product-1',
      name: 'Product',
      description: 'Description',
      priceInCents: 10_000,
      stock: 2,
    });

  it('restores a valid product without exposing mutable state', () => {
    const snapshot = product().toSnapshot();
    (snapshot as { stock: number }).stock = 0;

    expect(product().toSnapshot().stock).toBe(2);
  });

  it('rejects invalid persisted values', () => {
    expect(() =>
      Product.restore({
        id: 'product-1',
        name: 'Product',
        description: 'Description',
        priceInCents: 0,
        stock: 2,
      }),
    ).toThrow('Invalid product state');
    expect(() =>
      Product.restore({
        id: 'product-1',
        name: 'Product',
        description: 'Description',
        priceInCents: 10_000,
        stock: -1,
      }),
    ).toThrow('Invalid product state');
  });

  it('validates the requested quantity and stock', () => {
    expect(() => product().ensureAvailable(0)).toThrow(
      'Quantity must be a positive integer',
    );
    expect(() => product().ensureAvailable(3)).toThrow('Insufficient stock');
    expect(() => product().ensureAvailable(2)).not.toThrow();
  });
});
