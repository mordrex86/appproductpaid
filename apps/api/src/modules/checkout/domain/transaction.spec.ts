import { Transaction, TRANSACTION_STATUS } from './transaction';

describe('Transaction', () => {
  it('calculates all amounts on the server', () => {
    const transaction = Transaction.createPending({
      id: 'transaction-1',
      productId: 'product-1',
      customerId: 'customer-1',
      quantity: 2,
      unitPriceInCents: 10_000,
      createdAt: '2026-07-24T00:00:00.000Z',
    });

    expect(transaction.toSnapshot()).toEqual({
      id: 'transaction-1',
      productId: 'product-1',
      customerId: 'customer-1',
      quantity: 2,
      status: TRANSACTION_STATUS.pending,
      amounts: {
        product: 20_000,
        baseFee: 2_000,
        deliveryFee: 8_000,
        total: 30_000,
      },
      createdAt: '2026-07-24T00:00:00.000Z',
    });
  });

  it('restores a transaction using defensive amount copies', () => {
    const transaction = Transaction.restore({
      id: 'transaction-1',
      productId: 'product-1',
      customerId: 'customer-1',
      quantity: 1,
      status: TRANSACTION_STATUS.approved,
      amounts: {
        product: 10_000,
        baseFee: 2_000,
        deliveryFee: 8_000,
        total: 20_000,
      },
      createdAt: '2026-07-24T00:00:00.000Z',
    });
    const snapshot = transaction.toSnapshot();
    (snapshot.amounts as { total: number }).total = 0;

    expect(transaction.toSnapshot().amounts.total).toBe(20_000);
  });
});
