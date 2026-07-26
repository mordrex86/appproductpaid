import { Inject, Injectable } from '@nestjs/common';
import { CHECKOUT_REPOSITORY } from './checkout.repository';
import type { CheckoutRepository } from './checkout.repository';
import { TransactionNotFoundError } from './checkout.errors';
import type { TransactionSnapshot } from '../domain/transaction';

@Injectable()
export class GetTransactionUseCase {
  constructor(
    @Inject(CHECKOUT_REPOSITORY)
    private readonly repository: CheckoutRepository,
  ) {}

  async execute(transactionId: string): Promise<TransactionSnapshot> {
    const transaction = await this.repository.findTransaction(transactionId);

    if (transaction === undefined) {
      throw new TransactionNotFoundError();
    }

    return transaction.toSnapshot();
  }
}
