import type { CheckoutRepository } from './checkout.repository';
import { ProductNotFoundError } from './checkout.errors';
import type { ProductSnapshot } from '../domain/product';
import { failure, type Result, success } from './result';

export class GetProductUseCase {
  constructor(private readonly repository: CheckoutRepository) {}

  async execute(
    productId: string,
  ): Promise<Result<ProductSnapshot, ProductNotFoundError>> {
    const product = await this.repository.findProduct(productId);

    if (product === undefined) {
      return failure(new ProductNotFoundError());
    }

    return success(product.toSnapshot());
  }
}
