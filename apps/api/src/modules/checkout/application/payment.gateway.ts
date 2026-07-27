import type { CustomerData, DeliveryData } from './checkout.repository';
import type {
  TransactionAmounts,
  TransactionStatus,
} from '../domain/transaction';

export const PAYMENT_GATEWAY = Symbol('PAYMENT_GATEWAY');

export interface PaymentAgreement {
  readonly acceptanceToken: string;
  readonly permalink: string;
}

export interface PaymentConfiguration {
  readonly publicKey: string;
  readonly tokenizationUrl: string;
  readonly terms: PaymentAgreement;
  readonly personalData: PaymentAgreement;
}

export interface CreatePaymentInput {
  readonly reference: string;
  readonly paymentToken: string;
  readonly acceptanceToken: string;
  readonly personalDataToken: string;
  readonly amounts: TransactionAmounts;
  readonly customer: CustomerData;
  readonly delivery: DeliveryData;
}

export interface PaymentResult {
  readonly id: string;
  readonly status: TransactionStatus;
}

export interface PaymentGateway {
  getConfiguration(): Promise<PaymentConfiguration>;
  createPayment(input: CreatePaymentInput): Promise<PaymentResult>;
  getPayment(id: string): Promise<PaymentResult>;
}
