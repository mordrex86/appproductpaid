import type { CheckoutRepository } from './checkout.repository';
import {
  isCheckoutError,
  TransactionNotFoundError,
  type CheckoutError,
} from './checkout.errors';
import type { PaymentGateway } from './payment.gateway';
import {
  TRANSACTION_STATUS,
  type TransactionSnapshot,
} from '../domain/transaction';
import { failure, type Result, success } from './result';

export class SyncPaymentUseCase {
  constructor(
    private readonly repository: CheckoutRepository,
    private readonly gateway: PaymentGateway,
  ) {}

  async execute(
    transactionId: string,
  ): Promise<Result<TransactionSnapshot, CheckoutError>> {
    const transaction = await this.repository.findTransaction(transactionId);
    if (transaction === undefined) {
      return failure(new TransactionNotFoundError());
    }

    const current = transaction.toSnapshot();
    if (
      current.providerTransactionId === undefined ||
      current.status !== TRANSACTION_STATUS.pending
    ) {
      return success(current);
    }

    try {
      const payment = await this.gateway.getPayment(
        current.providerTransactionId,
      );
      return success(
        (
          await this.repository.savePaymentResult(
            transaction.withPayment(payment.id, payment.status),
          )
        ).toSnapshot(),
      );
    } catch (error) {
      if (isCheckoutError(error)) return failure(error);
      throw error;
    }
  }
}
