export class ProductNotFoundError extends Error {
  constructor() {
    super('Product not found');
  }
}

export class TransactionNotFoundError extends Error {
  constructor() {
    super('Transaction not found');
  }
}

export class InsufficientStockError extends Error {
  constructor() {
    super('Insufficient stock');
  }
}

export class IdempotencyConflictError extends Error {
  constructor() {
    super('The idempotency key was already used with another request');
  }
}

export class PaymentConfigurationError extends Error {
  constructor() {
    super('Payment service is not configured');
  }
}

export class PaymentProviderError extends Error {
  constructor(message = 'The payment service could not complete the request') {
    super(message);
  }
}

export type CheckoutError =
  | ProductNotFoundError
  | TransactionNotFoundError
  | InsufficientStockError
  | IdempotencyConflictError
  | PaymentConfigurationError
  | PaymentProviderError;

export function isCheckoutError(error: unknown): error is CheckoutError {
  return (
    error instanceof ProductNotFoundError ||
    error instanceof TransactionNotFoundError ||
    error instanceof InsufficientStockError ||
    error instanceof IdempotencyConflictError ||
    error instanceof PaymentConfigurationError ||
    error instanceof PaymentProviderError
  );
}
