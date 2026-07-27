import { Inject, Injectable } from '@nestjs/common';
import { PAYMENT_GATEWAY, type PaymentGateway } from './payment.gateway';

@Injectable()
export class GetPaymentConfigurationUseCase {
  constructor(
    @Inject(PAYMENT_GATEWAY)
    private readonly gateway: PaymentGateway,
  ) {}

  execute() {
    return this.gateway.getConfiguration();
  }
}
