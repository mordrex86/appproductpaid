import type { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import {
  IdempotencyConflictError,
  InsufficientStockError,
} from '../application/checkout.errors';
import type { PendingCheckout } from '../application/checkout.repository';
import { Product } from '../domain/product';
import { Transaction } from '../domain/transaction';
import { DynamoDbCheckoutRepository } from './dynamodb-checkout.repository';

describe('DynamoDbCheckoutRepository', () => {
  const send = jest.fn<Promise<Record<string, unknown>>, [unknown]>();
  const repository = new DynamoDbCheckoutRepository(
    { send } as unknown as DynamoDBDocumentClient,
    'payments',
  );
  const product = Product.restore({
    id: 'product-1',
    name: 'Product',
    description: 'Description',
    priceInCents: 10_000,
    stock: 3,
  });
  const transaction = Transaction.createPending({
    id: 'transaction-1',
    productId: 'product-1',
    customerId: 'customer-1',
    quantity: 1,
    unitPriceInCents: 10_000,
    createdAt: '2026-07-24T00:00:00.000Z',
  });
  const checkout: PendingCheckout = {
    idempotencyKey: 'checkout-attempt-0001',
    requestFingerprint: 'fingerprint',
    product,
    transaction,
    customer: {
      id: 'customer-1',
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
    send.mockReset();
  });

  it('updates catalog data without resetting existing stock', async () => {
    send.mockResolvedValueOnce({});
    await expect(repository.seedProduct(product)).resolves.toBeUndefined();

    send.mockRejectedValueOnce(new Error('unavailable'));
    await expect(repository.seedProduct(product)).rejects.toThrow(
      'unavailable',
    );
  });

  it('reads products and transactions with consistent reads', async () => {
    send
      .mockResolvedValueOnce({
        Item: {
          PK: 'PRODUCT#product-1',
          SK: 'METADATA',
          entityType: 'PRODUCT',
          GSI1PK: 'PRODUCTS',
          GSI1SK: 'Product#product-1',
          ...product.toSnapshot(),
        },
      })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({
        Item: {
          PK: 'TRANSACTION#transaction-1',
          SK: 'TRANSACTION',
          entityType: 'TRANSACTION',
          GSI1PK: 'CUSTOMER#customer-1',
          GSI1SK: '2026-07-24T00:00:00.000Z#transaction-1',
          ...transaction.toSnapshot(),
        },
      })
      .mockResolvedValueOnce({});

    await expect(repository.findProduct('product-1')).resolves.toEqual(product);
    await expect(repository.findProduct('missing')).resolves.toBeUndefined();
    await expect(repository.findTransaction('transaction-1')).resolves.toEqual(
      transaction,
    );
    await expect(
      repository.findTransaction('missing'),
    ).resolves.toBeUndefined();
  });

  it('writes a pending checkout atomically', async () => {
    send.mockResolvedValueOnce({});

    await expect(repository.createPending(checkout)).resolves.toBe(transaction);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('returns the existing transaction on an identical retry', async () => {
    send
      .mockRejectedValueOnce(
        Object.assign(new Error('cancelled'), {
          name: 'TransactionCanceledException',
        }),
      )
      .mockResolvedValueOnce({
        Item: {
          PK: 'IDEMPOTENCY#checkout-attempt-0001',
          SK: 'REQUEST',
          fingerprint: 'fingerprint',
          transactionId: 'transaction-1',
        },
      })
      .mockResolvedValueOnce({
        Item: {
          PK: 'TRANSACTION#transaction-1',
          SK: 'TRANSACTION',
          ...transaction.toSnapshot(),
        },
      });

    await expect(repository.createPending(checkout)).resolves.toEqual(
      transaction,
    );
  });

  it('rejects incompatible retries and unavailable stock', async () => {
    send
      .mockRejectedValueOnce(
        Object.assign(new Error('cancelled'), {
          name: 'TransactionCanceledException',
        }),
      )
      .mockResolvedValueOnce({
        Item: {
          fingerprint: 'another-fingerprint',
          transactionId: 'transaction-1',
        },
      });

    await expect(repository.createPending(checkout)).rejects.toBeInstanceOf(
      IdempotencyConflictError,
    );

    send
      .mockRejectedValueOnce(
        Object.assign(new Error('cancelled'), {
          name: 'TransactionCanceledException',
        }),
      )
      .mockResolvedValueOnce({});

    await expect(repository.createPending(checkout)).rejects.toBeInstanceOf(
      InsufficientStockError,
    );
  });

  it('does not hide unexpected DynamoDB failures', async () => {
    send.mockRejectedValueOnce(new Error('unavailable'));

    await expect(repository.createPending(checkout)).rejects.toThrow(
      'unavailable',
    );
  });

  it('loads customer and delivery data needed by the payment provider', async () => {
    send
      .mockResolvedValueOnce({
        Item: {
          PK: 'TRANSACTION#transaction-1',
          SK: 'TRANSACTION',
          ...transaction.toSnapshot(),
        },
      })
      .mockResolvedValueOnce({ Item: checkout.customer })
      .mockResolvedValueOnce({ Item: checkout.delivery });

    await expect(
      repository.findPaymentContext('transaction-1'),
    ).resolves.toMatchObject({
      customer: checkout.customer,
      delivery: checkout.delivery,
    });
  });

  it('persists pending and approved payment results', async () => {
    const pending = transaction.withPayment('wompi-1', 'PENDING');
    send.mockResolvedValueOnce({});
    await expect(repository.savePaymentResult(pending)).resolves.toEqual(
      pending,
    );

    const approved = transaction.withPayment('wompi-1', 'APPROVED');
    send.mockResolvedValueOnce({});
    await expect(repository.savePaymentResult(approved)).resolves.toEqual(
      approved,
    );
    expect(send).toHaveBeenCalledTimes(2);
  });
});
