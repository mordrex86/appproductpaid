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
        baseFee: 200_000,
        deliveryFee: 800_000,
        total: 1_020_000,
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
      providerTransactionId: 'wompi-1',
      amounts: {
        product: 10_000,
        baseFee: 200_000,
        deliveryFee: 800_000,
        total: 1_010_000,
      },
      createdAt: '2026-07-24T00:00:00.000Z',
    });
    const snapshot = transaction.toSnapshot();
    (snapshot.amounts as { total: number }).total = 0;

    expect(transaction.toSnapshot().amounts.total).toBe(1_010_000);
  });

  it('protects transaction invariants and payment transitions', () => {
    const pending = Transaction.createPending({
      id: 'transaction-1',
      productId: 'product-1',
      customerId: 'customer-1',
      quantity: 1,
      unitPriceInCents: 10_000,
      createdAt: '2026-07-24T00:00:00.000Z',
    });
    const failed = pending.failPayment();

    expect(failed.toSnapshot().status).toBe(TRANSACTION_STATUS.error);
    expect(failed.releasesStockReservation()).toBe(true);
    expect(() => failed.failPayment()).toThrow('Invalid payment transition');
    expect(() => failed.withPayment('wompi-1', 'APPROVED')).toThrow(
      'Invalid payment transition',
    );
    expect(() =>
      Transaction.createPending({
        id: 'transaction-1',
        productId: 'product-1',
        customerId: 'customer-1',
        quantity: 0,
        unitPriceInCents: 10_000,
        createdAt: '2026-07-24T00:00:00.000Z',
      }),
    ).toThrow('Invalid transaction state');
  });
});
