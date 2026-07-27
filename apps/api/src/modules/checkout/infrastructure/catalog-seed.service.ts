import { Inject, Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { CHECKOUT_REPOSITORY } from '../application/checkout.repository';
import type { CheckoutRepository } from '../application/checkout.repository';
import { Product } from '../domain/product';

export const FEATURED_PRODUCT_ID = 'wireless-headphones';

@Injectable()
export class CatalogSeedService implements OnApplicationBootstrap {
  constructor(
    @Inject(CHECKOUT_REPOSITORY)
    private readonly repository: CheckoutRepository,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.repository.seedProduct(
      Product.restore({
        id: FEATURED_PRODUCT_ID,
        name: 'Audífonos inalámbricos',
        description:
          'Audífonos bluetooth con estuche de carga y autonomía extendida.',
        priceInCents: 12_990_000,
        stock: 12,
      }),
    );
  }
}
