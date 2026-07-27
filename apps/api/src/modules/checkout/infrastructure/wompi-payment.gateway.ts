import { createHash } from 'node:crypto';
import {
  PaymentConfigurationError,
  PaymentProviderError,
} from '../application/checkout.errors';
import type {
  CreatePaymentInput,
  PaymentConfiguration,
  PaymentGateway,
  PaymentResult,
} from '../application/payment.gateway';
import {
  TRANSACTION_STATUS,
  type TransactionStatus,
} from '../domain/transaction';

interface WompiResponse {
  readonly data?: unknown;
  readonly error?: {
    readonly reason?: string;
  };
}

export class WompiPaymentGateway implements PaymentGateway {
  constructor(
    private readonly apiUrl: string,
    private readonly publicKey: string | undefined,
    private readonly privateKey: string | undefined,
    private readonly integritySecret: string | undefined,
    private readonly request: typeof fetch = fetch,
  ) {}

  async getConfiguration(): Promise<PaymentConfiguration> {
    const publicKey = this.required(this.publicKey);
    const response = await this.send(`${this.apiUrl}/merchants/${publicKey}`, {
      headers: { Accept: 'application/json' },
    });
    const merchant = response.data as
      | {
          presigned_acceptance?: {
            acceptance_token?: string;
            permalink?: string;
          };
          presigned_personal_data_auth?: {
            acceptance_token?: string;
            permalink?: string;
          };
        }
      | undefined;
    const terms = merchant?.presigned_acceptance;
    const personalData = merchant?.presigned_personal_data_auth;

    if (
      terms?.acceptance_token === undefined ||
      terms.permalink === undefined ||
      personalData?.acceptance_token === undefined ||
      personalData.permalink === undefined
    ) {
      throw new PaymentProviderError();
    }

    return {
      publicKey,
      tokenizationUrl: `${this.apiUrl}/tokens/cards`,
      terms: {
        acceptanceToken: terms.acceptance_token,
        permalink: terms.permalink,
      },
      personalData: {
        acceptanceToken: personalData.acceptance_token,
        permalink: personalData.permalink,
      },
    };
  }

  async createPayment(input: CreatePaymentInput): Promise<PaymentResult> {
    const privateKey = this.required(this.privateKey);
    const signature = createHash('sha256')
      .update(
        `${input.reference}${input.amounts.total}COP${this.required(this.integritySecret)}`,
      )
      .digest('hex');
    const response = await this.send(`${this.apiUrl}/transactions`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${privateKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        acceptance_token: input.acceptanceToken,
        accept_personal_auth: input.personalDataToken,
        amount_in_cents: input.amounts.total,
        currency: 'COP',
        customer_email: input.customer.email,
        customer_data: {
          full_name: input.customer.fullName,
          phone_number: input.customer.phone,
        },
        payment_method: {
          type: 'CARD',
          token: input.paymentToken,
          installments: 1,
        },
        payment_method_type: 'CARD',
        reference: input.reference,
        signature,
        shipping_address: {
          address_line_1: input.delivery.addressLine,
          city: input.delivery.city,
          country: 'CO',
          name: input.customer.fullName,
          phone_number: input.customer.phone,
          postal_code: input.delivery.postalCode,
          region: input.delivery.region,
        },
      }),
    });

    return this.toPaymentResult(response.data);
  }

  async getPayment(id: string): Promise<PaymentResult> {
    const response = await this.send(`${this.apiUrl}/transactions/${id}`, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${this.required(this.publicKey)}`,
      },
    });
    return this.toPaymentResult(response.data);
  }

  private required(value: string | undefined): string {
    if (value === undefined) {
      throw new PaymentConfigurationError();
    }
    return value;
  }

  private async send(input: string, init: RequestInit): Promise<WompiResponse> {
    try {
      return await this.read(
        await this.request(input, {
          ...init,
          signal: AbortSignal.timeout(10_000),
        }),
      );
    } catch (error) {
      if (error instanceof PaymentProviderError) throw error;
      throw new PaymentProviderError();
    }
  }

  private async read(response: Response): Promise<WompiResponse> {
    const body = (await response.json().catch(() => undefined)) as
      WompiResponse | undefined;
    if (!response.ok || body === undefined) {
      throw new PaymentProviderError(body?.error?.reason);
    }
    return body;
  }

  private toPaymentResult(value: unknown): PaymentResult {
    const transaction = value as
      { readonly id?: string; readonly status?: string } | undefined;
    if (transaction?.id === undefined || transaction.status === undefined) {
      throw new PaymentProviderError();
    }

    return {
      id: transaction.id,
      status: this.toStatus(transaction.status),
    };
  }

  private toStatus(status: string): TransactionStatus {
    switch (status) {
      case 'PENDING':
        return TRANSACTION_STATUS.pending;
      case 'APPROVED':
        return TRANSACTION_STATUS.approved;
      case 'DECLINED':
      case 'VOIDED':
        return TRANSACTION_STATUS.declined;
      default:
        return TRANSACTION_STATUS.error;
    }
  }
}
