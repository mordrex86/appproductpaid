import { createHash, randomUUID } from 'node:crypto';
import type {
  CheckoutRepository,
  CustomerData,
  DeliveryData,
} from './checkout.repository';
import {
  isCheckoutError,
  ProductNotFoundError,
  type CheckoutError,
} from './checkout.errors';
import { Transaction, TransactionSnapshot } from '../domain/transaction';
import { failure, type Result, success } from './result';

export interface CreatePendingTransactionCommand {
  readonly idempotencyKey: string;
  readonly productId: string;
  readonly quantity: number;
  readonly customer: Omit<CustomerData, 'id'>;
  readonly delivery: DeliveryData;
}

export class CreatePendingTransactionUseCase {
  constructor(private readonly repository: CheckoutRepository) {}

  async execute(
    command: CreatePendingTransactionCommand,
  ): Promise<Result<TransactionSnapshot, CheckoutError>> {
    const product = await this.repository.findProduct(command.productId);

    if (product === undefined) {
      return failure(new ProductNotFoundError());
    }

    const customerId = randomUUID();
    const transaction = Transaction.createPending({
      id: randomUUID(),
      productId: command.productId,
      customerId,
      quantity: command.quantity,
      unitPriceInCents: product.toSnapshot().priceInCents,
      createdAt: new Date().toISOString(),
    });
    const requestFingerprint = createHash('sha256')
      .update(
        JSON.stringify({
          productId: command.productId,
          quantity: command.quantity,
          customer: command.customer,
          delivery: command.delivery,
        }),
      )
      .digest('hex');

    try {
      const saved = await this.repository.createPending({
        idempotencyKey: command.idempotencyKey,
        requestFingerprint,
        product,
        customer: {
          id: customerId,
          ...command.customer,
          email: command.customer.email.toLowerCase(),
        },
        delivery: command.delivery,
        transaction,
      });

      return success(saved.toSnapshot());
    } catch (error) {
      if (isCheckoutError(error)) return failure(error);
      throw error;
    }
  }
}
