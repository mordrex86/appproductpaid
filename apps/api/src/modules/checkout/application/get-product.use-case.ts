import { Inject, Injectable } from '@nestjs/common';
import { CHECKOUT_REPOSITORY } from './checkout.repository';
import type { CheckoutRepository } from './checkout.repository';
import { ProductNotFoundError } from './checkout.errors';
import type { ProductSnapshot } from '../domain/product';

@Injectable()
export class GetProductUseCase {
  constructor(
    @Inject(CHECKOUT_REPOSITORY)
    private readonly repository: CheckoutRepository,
  ) {}

  async execute(productId: string): Promise<ProductSnapshot> {
    const product = await this.repository.findProduct(productId);

    if (product === undefined) {
      throw new ProductNotFoundError();
    }

    return product.toSnapshot();
  }
}
