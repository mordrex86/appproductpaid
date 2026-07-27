import type { TransactWriteCommandInput } from '@aws-sdk/lib-dynamodb';
import type { PendingCheckout } from '../application/checkout.repository';
import type { ProductSnapshot } from '../domain/product';
import type { TransactionSnapshot } from '../domain/transaction';
import { TRANSACTION_STATUS } from '../domain/transaction';

export interface StoredProduct extends ProductSnapshot {
  readonly PK: string;
  readonly SK: 'METADATA';
  readonly entityType: 'PRODUCT';
  readonly GSI1PK: 'PRODUCTS';
  readonly GSI1SK: string;
}

export interface StoredTransaction extends TransactionSnapshot {
  readonly PK: string;
  readonly SK: 'TRANSACTION';
  readonly entityType: 'TRANSACTION';
  readonly GSI1PK: string;
  readonly GSI1SK: string;
}

export interface StoredIdempotency {
  readonly fingerprint: string;
  readonly transactionId: string;
}

export interface StoredCustomer {
  readonly id: string;
  readonly fullName: string;
  readonly email: string;
  readonly phone: string;
}

export interface StoredDelivery {
  readonly addressLine: string;
  readonly city: string;
  readonly region: string;
  readonly postalCode: string;
}

export const productKey = (id: string): string => `PRODUCT#${id}`;
export const transactionKey = (id: string): string => `TRANSACTION#${id}`;
export const idempotencyKey = (key: string): string => `IDEMPOTENCY#${key}`;

export function toStoredProduct(product: ProductSnapshot): StoredProduct {
  return {
    PK: productKey(product.id),
    SK: 'METADATA',
    entityType: 'PRODUCT',
    GSI1PK: 'PRODUCTS',
    GSI1SK: `${product.name}#${product.id}`,
    ...product,
  };
}

export function toStoredTransaction(
  transaction: TransactionSnapshot,
): StoredTransaction {
  return {
    PK: transactionKey(transaction.id),
    SK: 'TRANSACTION',
    entityType: 'TRANSACTION',
    GSI1PK: `CUSTOMER#${transaction.customerId}`,
    GSI1SK: `${transaction.createdAt}#${transaction.id}`,
    ...transaction,
  };
}

export function pendingCheckoutItems(
  tableName: string,
  checkout: PendingCheckout,
): NonNullable<TransactWriteCommandInput['TransactItems']> {
  const transaction = checkout.transaction.toSnapshot();
  const productId = checkout.product.toSnapshot().id;

  return [
    {
      ConditionCheck: {
        TableName: tableName,
        Key: { PK: productKey(productId), SK: 'METADATA' },
        ConditionExpression: 'stock >= :quantity',
        ExpressionAttributeValues: { ':quantity': transaction.quantity },
      },
    },
    {
      Put: {
        TableName: tableName,
        Item: {
          PK: `CUSTOMER#${checkout.customer.id}`,
          SK: 'PROFILE',
          entityType: 'CUSTOMER',
          ...checkout.customer,
          createdAt: transaction.createdAt,
        },
        ConditionExpression: 'attribute_not_exists(PK)',
      },
    },
    {
      Put: {
        TableName: tableName,
        Item: {
          PK: transactionKey(transaction.id),
          SK: 'DELIVERY',
          entityType: 'DELIVERY',
          transactionId: transaction.id,
          customerId: checkout.customer.id,
          ...checkout.delivery,
          status: 'PENDING',
          createdAt: transaction.createdAt,
        },
        ConditionExpression: 'attribute_not_exists(PK)',
      },
    },
    {
      Put: {
        TableName: tableName,
        Item: toStoredTransaction(transaction),
        ConditionExpression: 'attribute_not_exists(PK)',
      },
    },
    {
      Put: {
        TableName: tableName,
        Item: {
          PK: idempotencyKey(checkout.idempotencyKey),
          SK: 'REQUEST',
          entityType: 'IDEMPOTENCY',
          fingerprint: checkout.requestFingerprint,
          transactionId: transaction.id,
          createdAt: transaction.createdAt,
        },
        ConditionExpression: 'attribute_not_exists(PK)',
      },
    },
  ];
}

export function completedPaymentItems(
  tableName: string,
  transaction: TransactionSnapshot,
): NonNullable<TransactWriteCommandInput['TransactItems']> {
  const updates: NonNullable<TransactWriteCommandInput['TransactItems']> = [
    {
      Update: {
        TableName: tableName,
        Key: { PK: transactionKey(transaction.id), SK: 'TRANSACTION' },
        UpdateExpression:
          'SET providerTransactionId = :providerId, #status = :status',
        ConditionExpression: '#status = :pending',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: {
          ':providerId': transaction.providerTransactionId,
          ':status': transaction.status,
          ':pending': TRANSACTION_STATUS.pending,
        },
      },
    },
    {
      Update: {
        TableName: tableName,
        Key: { PK: transactionKey(transaction.id), SK: 'DELIVERY' },
        UpdateExpression: 'SET #status = :status',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: {
          ':status':
            transaction.status === TRANSACTION_STATUS.approved
              ? 'READY'
              : 'CANCELLED',
        },
      },
    },
  ];

  if (transaction.status === TRANSACTION_STATUS.approved) {
    updates.push({
      Update: {
        TableName: tableName,
        Key: { PK: productKey(transaction.productId), SK: 'METADATA' },
        UpdateExpression: 'SET stock = stock - :quantity',
        ConditionExpression: 'stock >= :quantity',
        ExpressionAttributeValues: { ':quantity': transaction.quantity },
      },
    });
  }

  return updates;
}
