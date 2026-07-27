import {
  GetCommand,
  TransactWriteCommand,
  UpdateCommand,
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
import { Product } from '../domain/product';
import { Transaction } from '../domain/transaction';
import { TRANSACTION_STATUS } from '../domain/transaction';
import {
  completedPaymentItems,
  idempotencyKey,
  pendingCheckoutItems,
  productKey,
  StoredCustomer,
  StoredDelivery,
  StoredIdempotency,
  StoredProduct,
  StoredTransaction,
  toStoredProduct,
  transactionKey,
} from './dynamodb-checkout.items';

export class DynamoDbCheckoutRepository implements CheckoutRepository {
  constructor(
    private readonly client: DynamoDBDocumentClient,
    private readonly tableName: string,
  ) {}

  async seedProduct(product: Product): Promise<void> {
    const snapshot = product.toSnapshot();
    const stored = toStoredProduct(snapshot);
    await this.client.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: { PK: stored.PK, SK: stored.SK },
        UpdateExpression:
          'SET id = :id, #name = :name, description = :description, ' +
          'priceInCents = :price, stock = if_not_exists(stock, :stock), ' +
          'entityType = :entityType, GSI1PK = :gsi1pk, GSI1SK = :gsi1sk',
        ExpressionAttributeNames: { '#name': 'name' },
        ExpressionAttributeValues: {
          ':id': stored.id,
          ':name': stored.name,
          ':description': stored.description,
          ':price': stored.priceInCents,
          ':stock': stored.stock,
          ':entityType': stored.entityType,
          ':gsi1pk': stored.GSI1PK,
          ':gsi1sk': stored.GSI1SK,
        },
      }),
    );
  }

  async findProduct(id: string): Promise<Product | undefined> {
    const response = await this.client.send(
      new GetCommand({
        TableName: this.tableName,
        Key: { PK: productKey(id), SK: 'METADATA' },
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
    try {
      await this.client.send(
        new TransactWriteCommand({
          TransactItems: pendingCheckoutItems(this.tableName, checkout),
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
        Key: { PK: transactionKey(id), SK: 'TRANSACTION' },
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
      ...(item.providerTransactionId === undefined
        ? {}
        : { providerTransactionId: item.providerTransactionId }),
      amounts: item.amounts,
      createdAt: item.createdAt,
    });
  }

  async findPaymentContext(transactionId: string) {
    const transaction = await this.findTransaction(transactionId);
    if (transaction === undefined) return undefined;

    const customerId = transaction.toSnapshot().customerId;
    const [customerResponse, deliveryResponse] = await Promise.all([
      this.client.send(
        new GetCommand({
          TableName: this.tableName,
          Key: { PK: `CUSTOMER#${customerId}`, SK: 'PROFILE' },
          ConsistentRead: true,
        }),
      ),
      this.client.send(
        new GetCommand({
          TableName: this.tableName,
          Key: { PK: transactionKey(transactionId), SK: 'DELIVERY' },
          ConsistentRead: true,
        }),
      ),
    ]);
    if (
      customerResponse.Item === undefined ||
      deliveryResponse.Item === undefined
    ) {
      return undefined;
    }

    const customer = customerResponse.Item as StoredCustomer;
    const delivery = deliveryResponse.Item as StoredDelivery;
    return {
      transaction,
      customer: {
        id: customer.id,
        fullName: customer.fullName,
        email: customer.email,
        phone: customer.phone,
      },
      delivery: {
        addressLine: delivery.addressLine,
        city: delivery.city,
        region: delivery.region,
        postalCode: delivery.postalCode,
      },
    };
  }

  async savePaymentResult(transaction: Transaction): Promise<Transaction> {
    const snapshot = transaction.toSnapshot();
    if (snapshot.providerTransactionId === undefined) return transaction;

    if (snapshot.status === TRANSACTION_STATUS.pending) {
      await this.client.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: { PK: transactionKey(snapshot.id), SK: 'TRANSACTION' },
          UpdateExpression:
            'SET providerTransactionId = :providerId, #status = :status',
          ExpressionAttributeNames: { '#status': 'status' },
          ExpressionAttributeValues: {
            ':providerId': snapshot.providerTransactionId,
            ':status': snapshot.status,
          },
        }),
      );
      return transaction;
    }

    try {
      await this.client.send(
        new TransactWriteCommand({
          TransactItems: completedPaymentItems(this.tableName, snapshot),
        }),
      );
      return transaction;
    } catch (error) {
      if (!this.isTransactionCanceled(error)) throw error;
      const existing = await this.findTransaction(snapshot.id);
      if (
        existing !== undefined &&
        existing.toSnapshot().status !== TRANSACTION_STATUS.pending
      ) {
        return existing;
      }
      throw new InsufficientStockError();
    }
  }

  private async findByIdempotencyKey(
    key: string,
  ): Promise<StoredIdempotency | undefined> {
    const response = await this.client.send(
      new GetCommand({
        TableName: this.tableName,
        Key: { PK: idempotencyKey(key), SK: 'REQUEST' },
        ConsistentRead: true,
      }),
    );
    return response.Item as StoredIdempotency | undefined;
  }

  private isTransactionCanceled(error: unknown): boolean {
    return (
      error instanceof Error && error.name === 'TransactionCanceledException'
    );
  }
}
