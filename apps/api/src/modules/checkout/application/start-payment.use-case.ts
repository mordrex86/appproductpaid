import { Inject, Injectable } from '@nestjs/common';
import {
  CHECKOUT_REPOSITORY,
  type CheckoutRepository,
} from './checkout.repository';
import { TransactionNotFoundError } from './checkout.errors';
import { PAYMENT_GATEWAY, type PaymentGateway } from './payment.gateway';

export interface StartPaymentCommand {
  readonly transactionId: string;
  readonly paymentToken: string;
  readonly acceptanceToken: string;
  readonly personalDataToken: string;
}

@Injectable()
export class StartPaymentUseCase {
  constructor(
    @Inject(CHECKOUT_REPOSITORY)
    private readonly repository: CheckoutRepository,
    @Inject(PAYMENT_GATEWAY)
    private readonly gateway: PaymentGateway,
  ) {}

  async execute(command: StartPaymentCommand) {
    const context = await this.repository.findPaymentContext(
      command.transactionId,
    );
    if (context === undefined) {
      throw new TransactionNotFoundError();
    }

    const current = context.transaction.toSnapshot();
    if (current.providerTransactionId !== undefined) {
      return current;
    }

    const payment = await this.gateway.createPayment({
      reference: current.id,
      paymentToken: command.paymentToken,
      acceptanceToken: command.acceptanceToken,
      personalDataToken: command.personalDataToken,
      amounts: current.amounts,
      customer: context.customer,
      delivery: context.delivery,
    });
    return (
      await this.repository.savePaymentResult(
        context.transaction.withPayment(payment.id, payment.status),
      )
    ).toSnapshot();
  }
}
