import type { CheckoutRepository } from './checkout.repository';
import {
  isCheckoutError,
  TransactionNotFoundError,
  type CheckoutError,
} from './checkout.errors';
import type { PaymentGateway } from './payment.gateway';
import type { TransactionSnapshot } from '../domain/transaction';
import { failure, type Result, success } from './result';

export interface StartPaymentCommand {
  readonly transactionId: string;
  readonly paymentToken: string;
  readonly acceptanceToken: string;
  readonly personalDataToken: string;
}

export class StartPaymentUseCase {
  constructor(
    private readonly repository: CheckoutRepository,
    private readonly gateway: PaymentGateway,
  ) {}

  async execute(
    command: StartPaymentCommand,
  ): Promise<Result<TransactionSnapshot, CheckoutError>> {
    const context = await this.repository.findPaymentContext(
      command.transactionId,
    );
    if (context === undefined) {
      return failure(new TransactionNotFoundError());
    }

    const current = context.transaction.toSnapshot();
    if (current.providerTransactionId !== undefined) {
      return success(current);
    }

    let claimed: boolean;
    try {
      claimed = await this.repository.claimPayment(context.transaction);
    } catch (error) {
      if (isCheckoutError(error)) return failure(error);
      throw error;
    }
    if (!claimed) {
      const transaction =
        (await this.repository.findTransaction(current.id)) ??
        context.transaction;
      return success(transaction.toSnapshot());
    }

    try {
      const payment = await this.gateway.createPayment({
        reference: current.id,
        paymentToken: command.paymentToken,
        acceptanceToken: command.acceptanceToken,
        personalDataToken: command.personalDataToken,
        amounts: current.amounts,
        customer: context.customer,
        delivery: context.delivery,
      });
      const saved = await this.repository.savePaymentResult(
        context.transaction.withPayment(payment.id, payment.status),
      );
      return success(saved.toSnapshot());
    } catch (error) {
      await this.repository.savePaymentResult(
        context.transaction.failPayment(),
      );
      if (isCheckoutError(error)) return failure(error);
      throw error;
    }
  }
}
