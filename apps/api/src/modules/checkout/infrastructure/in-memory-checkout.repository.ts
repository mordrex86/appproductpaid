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

interface IdempotencyRecord {
  readonly fingerprint: string;
  readonly transactionId: string;
}

export class InMemoryCheckoutRepository implements CheckoutRepository {
  private readonly products = new Map<string, Product>();
  private readonly transactions = new Map<string, Transaction>();
  private readonly idempotencyRecords = new Map<string, IdempotencyRecord>();

  seedProduct(product: Product): Promise<void> {
    const snapshot = product.toSnapshot();
    if (!this.products.has(snapshot.id)) {
      this.products.set(snapshot.id, product);
    }
    return Promise.resolve();
  }

  findProduct(id: string): Promise<Product | undefined> {
    return Promise.resolve(this.products.get(id));
  }

  async createPending(checkout: PendingCheckout): Promise<Transaction> {
    const existing = this.idempotencyRecords.get(checkout.idempotencyKey);

    if (existing !== undefined) {
      if (existing.fingerprint !== checkout.requestFingerprint) {
        throw new IdempotencyConflictError();
      }

      const transaction = this.transactions.get(existing.transactionId);
      if (transaction === undefined) {
        throw new Error('Invalid idempotency record');
      }
      return transaction;
    }

    const product = await this.findProduct(checkout.product.toSnapshot().id);
    if (
      product === undefined ||
      product.toSnapshot().stock < checkout.transaction.toSnapshot().quantity
    ) {
      throw new InsufficientStockError();
    }

    const transactionId = checkout.transaction.toSnapshot().id;
    this.transactions.set(transactionId, checkout.transaction);
    this.idempotencyRecords.set(checkout.idempotencyKey, {
      fingerprint: checkout.requestFingerprint,
      transactionId,
    });

    return checkout.transaction;
  }

  findTransaction(id: string): Promise<Transaction | undefined> {
    return Promise.resolve(this.transactions.get(id));
  }
}
