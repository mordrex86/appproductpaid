import {
  GetCommand,
  PutCommand,
  TransactWriteCommand,
} from '@aws-sdk/lib-dynamodb';
import type { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import {
  CheckoutRepository,
  PendingCheckout,
} from '../application/checkout.repository';
import {
  IdempotencyConflictError,
  InsufficientStockError,
} from '../application/checkout.errors';
import { Product, ProductSnapshot } from '../domain/product';
import { Transaction, TransactionSnapshot } from '../domain/transaction';

interface StoredProduct extends ProductSnapshot {
  readonly PK: string;
  readonly SK: 'METADATA';
  readonly entityType: 'PRODUCT';
  readonly GSI1PK: 'PRODUCTS';
  readonly GSI1SK: string;
}

interface StoredTransaction extends TransactionSnapshot {
  readonly PK: string;
  readonly SK: 'TRANSACTION';
  readonly entityType: 'TRANSACTION';
  readonly GSI1PK: string;
  readonly GSI1SK: string;
}

interface StoredIdempotency {
  readonly PK: string;
  readonly SK: 'REQUEST';
  readonly fingerprint: string;
  readonly transactionId: string;
}

export class DynamoDbCheckoutRepository implements CheckoutRepository {
  constructor(
    private readonly client: DynamoDBDocumentClient,
    private readonly tableName: string,
  ) {}

  async seedProduct(product: Product): Promise<void> {
    const snapshot = product.toSnapshot();

    try {
      await this.client.send(
        new PutCommand({
          TableName: this.tableName,
          Item: this.toStoredProduct(snapshot),
          ConditionExpression: 'attribute_not_exists(PK)',
        }),
      );
    } catch (error) {
      if (!this.isConditionalFailure(error)) {
        throw error;
      }
    }
  }

  async findProduct(id: string): Promise<Product | undefined> {
    const response = await this.client.send(
      new GetCommand({
        TableName: this.tableName,
        Key: { PK: this.productKey(id), SK: 'METADATA' },
        ConsistentRead: true,
      }),
    );

    if (response.Item === undefined) {
      return undefined;
    }

    const item = response.Item as StoredProduct;
    return Product.restore({
      id: item.id,
      name: item.name,
      description: item.description,
      priceInCents: item.priceInCents,
      stock: item.stock,
    });
  }

  async createPending(checkout: PendingCheckout): Promise<Transaction> {
    const transaction = checkout.transaction.toSnapshot();
    const productId = checkout.product.toSnapshot().id;

    try {
      await this.client.send(
        new TransactWriteCommand({
          TransactItems: [
            {
              ConditionCheck: {
                TableName: this.tableName,
                Key: { PK: this.productKey(productId), SK: 'METADATA' },
                ConditionExpression: 'stock >= :quantity',
                ExpressionAttributeValues: {
                  ':quantity': transaction.quantity,
                },
              },
            },
            {
              Put: {
                TableName: this.tableName,
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
                TableName: this.tableName,
                Item: {
                  PK: `TRANSACTION#${transaction.id}`,
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
                TableName: this.tableName,
                Item: this.toStoredTransaction(transaction),
                ConditionExpression: 'attribute_not_exists(PK)',
              },
            },
            {
              Put: {
                TableName: this.tableName,
                Item: {
                  PK: this.idempotencyKey(checkout.idempotencyKey),
                  SK: 'REQUEST',
                  entityType: 'IDEMPOTENCY',
                  fingerprint: checkout.requestFingerprint,
                  transactionId: transaction.id,
                  createdAt: transaction.createdAt,
                },
                ConditionExpression: 'attribute_not_exists(PK)',
              },
            },
          ],
        }),
      );
      return checkout.transaction;
    } catch (error) {
      if (!this.isTransactionCanceled(error)) {
        throw error;
      }

      const existing = await this.findByIdempotencyKey(checkout.idempotencyKey);
      if (existing !== undefined) {
        if (existing.fingerprint !== checkout.requestFingerprint) {
          throw new IdempotencyConflictError();
        }

        const saved = await this.findTransaction(existing.transactionId);
        if (saved !== undefined) {
          return saved;
        }
      }

      throw new InsufficientStockError();
    }
  }

  async findTransaction(id: string): Promise<Transaction | undefined> {
    const response = await this.client.send(
      new GetCommand({
        TableName: this.tableName,
        Key: { PK: `TRANSACTION#${id}`, SK: 'TRANSACTION' },
        ConsistentRead: true,
      }),
    );

    if (response.Item === undefined) {
      return undefined;
    }

    const item = response.Item as StoredTransaction;
    return Transaction.restore({
      id: item.id,
      productId: item.productId,
      customerId: item.customerId,
      quantity: item.quantity,
      status: item.status,
      amounts: item.amounts,
      createdAt: item.createdAt,
    });
  }

  private async findByIdempotencyKey(
    key: string,
  ): Promise<StoredIdempotency | undefined> {
    const response = await this.client.send(
      new GetCommand({
        TableName: this.tableName,
        Key: { PK: this.idempotencyKey(key), SK: 'REQUEST' },
        ConsistentRead: true,
      }),
    );
    return response.Item as StoredIdempotency | undefined;
  }

  private toStoredProduct(product: ProductSnapshot): StoredProduct {
    return {
      PK: this.productKey(product.id),
      SK: 'METADATA',
      entityType: 'PRODUCT',
      GSI1PK: 'PRODUCTS',
      GSI1SK: `${product.name}#${product.id}`,
      ...product,
    };
  }

  private toStoredTransaction(
    transaction: TransactionSnapshot,
  ): StoredTransaction {
    return {
      PK: `TRANSACTION#${transaction.id}`,
      SK: 'TRANSACTION',
      entityType: 'TRANSACTION',
      GSI1PK: `CUSTOMER#${transaction.customerId}`,
      GSI1SK: `${transaction.createdAt}#${transaction.id}`,
      ...transaction,
    };
  }

  private productKey(id: string): string {
    return `PRODUCT#${id}`;
  }

  private idempotencyKey(key: string): string {
    return `IDEMPOTENCY#${key}`;
  }

  private isConditionalFailure(error: unknown): boolean {
    return (
      error instanceof Error && error.name === 'ConditionalCheckFailedException'
    );
  }

  private isTransactionCanceled(error: unknown): boolean {
    return (
      error instanceof Error && error.name === 'TransactionCanceledException'
    );
  }
}
