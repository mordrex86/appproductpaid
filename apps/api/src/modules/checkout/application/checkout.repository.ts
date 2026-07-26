import { Product } from '../domain/product';
import { Transaction } from '../domain/transaction';

export const CHECKOUT_REPOSITORY = Symbol('CHECKOUT_REPOSITORY');

export interface CustomerData {
  readonly id: string;
  readonly fullName: string;
  readonly email: string;
  readonly phone: string;
}

export interface DeliveryData {
  readonly addressLine: string;
  readonly city: string;
  readonly region: string;
  readonly postalCode: string;
}

export interface PendingCheckout {
  readonly idempotencyKey: string;
  readonly requestFingerprint: string;
  readonly product: Product;
  readonly customer: CustomerData;
  readonly delivery: DeliveryData;
  readonly transaction: Transaction;
}

export interface CheckoutRepository {
  seedProduct(product: Product): Promise<void>;
  findProduct(id: string): Promise<Product | undefined>;
  createPending(checkout: PendingCheckout): Promise<Transaction>;
  findTransaction(id: string): Promise<Transaction | undefined>;
}
