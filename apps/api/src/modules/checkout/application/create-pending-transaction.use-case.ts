import { createHash, randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { CHECKOUT_REPOSITORY } from './checkout.repository';
import type {
  CheckoutRepository,
  CustomerData,
  DeliveryData,
} from './checkout.repository';
import {
  InsufficientStockError,
  ProductNotFoundError,
} from './checkout.errors';
import { Transaction, TransactionSnapshot } from '../domain/transaction';

export interface CreatePendingTransactionCommand {
  readonly idempotencyKey: string;
  readonly productId: string;
  readonly quantity: number;
  readonly customer: Omit<CustomerData, 'id'>;
  readonly delivery: DeliveryData;
}

@Injectable()
export class CreatePendingTransactionUseCase {
  constructor(
    @Inject(CHECKOUT_REPOSITORY)
    private readonly repository: CheckoutRepository,
  ) {}

  async execute(
    command: CreatePendingTransactionCommand,
  ): Promise<TransactionSnapshot> {
    const product = await this.repository.findProduct(command.productId);

    if (product === undefined) {
      throw new ProductNotFoundError();
    }

    try {
      product.ensureAvailable(command.quantity);
    } catch {
      throw new InsufficientStockError();
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

    return saved.toSnapshot();
  }
}
