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
