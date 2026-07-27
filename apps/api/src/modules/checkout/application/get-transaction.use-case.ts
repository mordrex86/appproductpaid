import type { CheckoutRepository } from './checkout.repository';
import { TransactionNotFoundError } from './checkout.errors';
import type { TransactionSnapshot } from '../domain/transaction';
import { failure, type Result, success } from './result';

export class GetTransactionUseCase {
  constructor(private readonly repository: CheckoutRepository) {}

  async execute(
    transactionId: string,
  ): Promise<Result<TransactionSnapshot, TransactionNotFoundError>> {
    const transaction = await this.repository.findTransaction(transactionId);

    if (transaction === undefined) {
      return failure(new TransactionNotFoundError());
    }

    return success(transaction.toSnapshot());
  }
}
