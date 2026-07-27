import {
  ConflictException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  IdempotencyConflictError,
  InsufficientStockError,
  PaymentConfigurationError,
  PaymentProviderError,
  ProductNotFoundError,
  TransactionNotFoundError,
} from '../../application/checkout.errors';

export function rethrowCheckoutHttpError(error: unknown): never {
  if (error instanceof ProductNotFoundError) {
    throw new NotFoundException({
      code: 'PRODUCT_NOT_FOUND',
      message: error.message,
    });
  }
  if (error instanceof TransactionNotFoundError) {
    throw new NotFoundException({
      code: 'TRANSACTION_NOT_FOUND',
      message: error.message,
    });
  }
  if (error instanceof InsufficientStockError) {
    throw new ConflictException({
      code: 'INSUFFICIENT_STOCK',
      message: error.message,
    });
  }
  if (error instanceof IdempotencyConflictError) {
    throw new ConflictException({
      code: 'IDEMPOTENCY_CONFLICT',
      message: error.message,
    });
  }
  if (
    error instanceof PaymentConfigurationError ||
    error instanceof PaymentProviderError
  ) {
    throw new ServiceUnavailableException({
      code: 'PAYMENT_SERVICE_UNAVAILABLE',
      message: 'Payment service is temporarily unavailable',
    });
  }
  throw error;
}
