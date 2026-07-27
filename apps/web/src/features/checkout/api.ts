import type {
  Customer,
  Delivery,
  Product,
  Transaction,
} from './model/checkoutSlice';

interface CreateTransactionInput {
  readonly idempotencyKey: string;
  readonly productId: string;
  readonly quantity: number;
  readonly customer: Customer;
  readonly delivery: Delivery;
}

export interface PaymentConfiguration {
  readonly publicKey: string;
  readonly tokenizationUrl: string;
  readonly terms: {
    readonly acceptanceToken: string;
    readonly permalink: string;
  };
  readonly personalData: {
    readonly acceptanceToken: string;
    readonly permalink: string;
  };
}

export interface CardTokenInput {
  readonly number: string;
  readonly cardholder: string;
  readonly expiry: string;
  readonly cvc: string;
}

async function readResponse<T>(response: Response): Promise<T> {
  if (response.ok) {
    return (await response.json()) as T;
  }

  const body = (await response.json().catch(() => undefined)) as
    { message?: string } | undefined;
  throw new Error(body?.message ?? 'No fue posible completar la solicitud.');
}

export async function getProduct(
  productId = 'wireless-headphones',
): Promise<Product> {
  return readResponse<Product>(
    await fetch(`/api/v1/products/${productId}`, {
      headers: { Accept: 'application/json' },
    }),
  );
}

export async function createTransaction(
  input: CreateTransactionInput,
): Promise<Transaction> {
  return readResponse<Transaction>(
    await fetch('/api/v1/transactions', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'Idempotency-Key': input.idempotencyKey,
      },
      body: JSON.stringify({
        productId: input.productId,
        quantity: input.quantity,
        customer: input.customer,
        delivery: input.delivery,
      }),
    }),
  );
}

export async function getPaymentConfiguration(): Promise<PaymentConfiguration> {
  return readResponse<PaymentConfiguration>(
    await fetch('/api/v1/payments/config', {
      headers: { Accept: 'application/json' },
    }),
  );
}

export async function tokenizeCard(
  configuration: PaymentConfiguration,
  card: CardTokenInput,
): Promise<string> {
  const [expMonth, expYear] = card.expiry.split('/');
  const response = await fetch(configuration.tokenizationUrl, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${configuration.publicKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      number: card.number.replace(/\D/g, ''),
      card_holder: card.cardholder.trim(),
      exp_month: expMonth,
      exp_year: expYear,
      cvc: card.cvc,
    }),
  });
  const body = (await response.json().catch(() => undefined)) as
    { data?: { id?: string }; error?: { reason?: string } } | undefined;
  if (!response.ok || body?.data?.id === undefined) {
    throw new Error(
      'No pudimos validar la tarjeta. Revisa los datos e intenta de nuevo.',
    );
  }
  return body.data.id;
}

export async function startPayment(
  transactionId: string,
  input: {
    readonly paymentToken: string;
    readonly acceptanceToken: string;
    readonly personalDataToken: string;
  },
): Promise<Transaction> {
  return readResponse<Transaction>(
    await fetch(`/api/v1/transactions/${transactionId}/payment`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
    }),
  );
}

export async function syncPayment(transactionId: string): Promise<Transaction> {
  return readResponse<Transaction>(
    await fetch(`/api/v1/transactions/${transactionId}/payment/status`, {
      method: 'POST',
      headers: { Accept: 'application/json' },
    }),
  );
}
