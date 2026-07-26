export const TRANSACTION_STATUS = {
  pending: 'PENDING',
  approved: 'APPROVED',
  declined: 'DECLINED',
  error: 'ERROR',
} as const;

export type TransactionStatus =
  (typeof TRANSACTION_STATUS)[keyof typeof TRANSACTION_STATUS];

export interface TransactionAmounts {
  readonly product: number;
  readonly baseFee: number;
  readonly deliveryFee: number;
  readonly total: number;
}

export interface TransactionSnapshot {
  readonly id: string;
  readonly productId: string;
  readonly customerId: string;
  readonly quantity: number;
  readonly status: TransactionStatus;
  readonly amounts: TransactionAmounts;
  readonly createdAt: string;
}

const BASE_FEE_IN_CENTS = 2_000;
const DELIVERY_FEE_IN_CENTS = 8_000;

export class Transaction {
  private constructor(private readonly state: TransactionSnapshot) {}

  static createPending(input: {
    id: string;
    productId: string;
    customerId: string;
    quantity: number;
    unitPriceInCents: number;
    createdAt: string;
  }): Transaction {
    const product = input.unitPriceInCents * input.quantity;

    return new Transaction({
      id: input.id,
      productId: input.productId,
      customerId: input.customerId,
      quantity: input.quantity,
      status: TRANSACTION_STATUS.pending,
      amounts: {
        product,
        baseFee: BASE_FEE_IN_CENTS,
        deliveryFee: DELIVERY_FEE_IN_CENTS,
        total: product + BASE_FEE_IN_CENTS + DELIVERY_FEE_IN_CENTS,
      },
      createdAt: input.createdAt,
    });
  }

  static restore(state: TransactionSnapshot): Transaction {
    return new Transaction({
      ...state,
      amounts: { ...state.amounts },
    });
  }

  toSnapshot(): TransactionSnapshot {
    return {
      ...this.state,
      amounts: { ...this.state.amounts },
    };
  }
}
