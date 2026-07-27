import { Inject, Injectable } from '@nestjs/common';
import {
  CHECKOUT_REPOSITORY,
  type CheckoutRepository,
} from './checkout.repository';
import { TransactionNotFoundError } from './checkout.errors';
import { PAYMENT_GATEWAY, type PaymentGateway } from './payment.gateway';
import { TRANSACTION_STATUS } from '../domain/transaction';

@Injectable()
export class SyncPaymentUseCase {
  constructor(
    @Inject(CHECKOUT_REPOSITORY)
    private readonly repository: CheckoutRepository,
    @Inject(PAYMENT_GATEWAY)
    private readonly gateway: PaymentGateway,
  ) {}

  async execute(transactionId: string) {
    const transaction = await this.repository.findTransaction(transactionId);
    if (transaction === undefined) {
      throw new TransactionNotFoundError();
    }

    const current = transaction.toSnapshot();
    if (
      current.providerTransactionId === undefined ||
      current.status !== TRANSACTION_STATUS.pending
    ) {
      return current;
    }

    const payment = await this.gateway.getPayment(
      current.providerTransactionId,
    );
    return (
      await this.repository.savePaymentResult(
        transaction.withPayment(payment.id, payment.status),
      )
    ).toSnapshot();
  }
}
