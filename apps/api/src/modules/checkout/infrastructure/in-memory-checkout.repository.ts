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

interface IdempotencyRecord {
  readonly fingerprint: string;
  readonly transactionId: string;
}

export class InMemoryCheckoutRepository implements CheckoutRepository {
  private readonly products = new Map<string, Product>();
  private readonly transactions = new Map<string, Transaction>();
  private readonly checkouts = new Map<string, PendingCheckout>();
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
    this.checkouts.set(transactionId, checkout);
    this.idempotencyRecords.set(checkout.idempotencyKey, {
      fingerprint: checkout.requestFingerprint,
      transactionId,
    });

    return checkout.transaction;
  }

  findTransaction(id: string): Promise<Transaction | undefined> {
    return Promise.resolve(this.transactions.get(id));
  }

  findPaymentContext(transactionId: string) {
    const checkout = this.checkouts.get(transactionId);
    if (checkout === undefined) return Promise.resolve(undefined);
    return Promise.resolve({
      transaction: this.transactions.get(transactionId) ?? checkout.transaction,
      customer: checkout.customer,
      delivery: checkout.delivery,
    });
  }

  savePaymentResult(transaction: Transaction): Promise<Transaction> {
    const next = transaction.toSnapshot();
    const current = this.transactions.get(next.id);
    if (current === undefined) {
      return Promise.resolve(transaction);
    }

    if (
      current.toSnapshot().status === TRANSACTION_STATUS.pending &&
      next.status === TRANSACTION_STATUS.approved
    ) {
      const product = this.products.get(next.productId);
      const productSnapshot = product?.toSnapshot();
      if (
        productSnapshot === undefined ||
        productSnapshot.stock < next.quantity
      ) {
        throw new InsufficientStockError();
      }
      this.products.set(
        next.productId,
        Product.restore({
          ...productSnapshot,
          stock: productSnapshot.stock - next.quantity,
        }),
      );
    }

    if (current.toSnapshot().status === TRANSACTION_STATUS.pending) {
      this.transactions.set(next.id, transaction);
      return Promise.resolve(transaction);
    }
    return Promise.resolve(current);
  }
}
