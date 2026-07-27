import type { PaymentConfiguration, PaymentGateway } from './payment.gateway';
import { isCheckoutError, type CheckoutError } from './checkout.errors';
import { failure, type Result, success } from './result';

export class GetPaymentConfigurationUseCase {
  constructor(private readonly gateway: PaymentGateway) {}

  async execute(): Promise<Result<PaymentConfiguration, CheckoutError>> {
    try {
      return success(await this.gateway.getConfiguration());
    } catch (error) {
      if (isCheckoutError(error)) return failure(error);
      throw error;
    }
  }
}
