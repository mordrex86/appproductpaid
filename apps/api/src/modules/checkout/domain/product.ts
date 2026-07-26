export interface ProductSnapshot {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly priceInCents: number;
  readonly stock: number;
}

export class Product {
  private constructor(private readonly state: ProductSnapshot) {}

  static restore(state: ProductSnapshot): Product {
    if (
      !Number.isInteger(state.priceInCents) ||
      state.priceInCents <= 0 ||
      !Number.isInteger(state.stock) ||
      state.stock < 0
    ) {
      throw new Error('Invalid product state');
    }

    return new Product({ ...state });
  }

  ensureAvailable(quantity: number): void {
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new Error('Quantity must be a positive integer');
    }

    if (this.state.stock < quantity) {
      throw new Error('Insufficient stock');
    }
  }

  toSnapshot(): ProductSnapshot {
    return { ...this.state };
  }
}
