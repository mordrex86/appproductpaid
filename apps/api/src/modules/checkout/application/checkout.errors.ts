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
