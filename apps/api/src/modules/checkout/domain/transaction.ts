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
  readonly providerTransactionId?: string;
  readonly amounts: TransactionAmounts;
  readonly createdAt: string;
}

const BASE_FEE_IN_CENTS = 200_000;
const DELIVERY_FEE_IN_CENTS = 800_000;

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

    return Transaction.restore({
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
    if (
      state.id.length === 0 ||
      state.productId.length === 0 ||
      state.customerId.length === 0 ||
      !Number.isInteger(state.quantity) ||
      state.quantity <= 0 ||
      !Object.values(TRANSACTION_STATUS).includes(state.status) ||
      !Number.isInteger(state.amounts.product) ||
      !Number.isInteger(state.amounts.baseFee) ||
      !Number.isInteger(state.amounts.deliveryFee) ||
      state.amounts.product <= 0 ||
      state.amounts.baseFee < 0 ||
      state.amounts.deliveryFee < 0 ||
      state.amounts.total !==
        state.amounts.product +
          state.amounts.baseFee +
          state.amounts.deliveryFee ||
      ((state.status === TRANSACTION_STATUS.approved ||
        state.status === TRANSACTION_STATUS.declined) &&
        state.providerTransactionId === undefined) ||
      Number.isNaN(Date.parse(state.createdAt))
    ) {
      throw new Error('Invalid transaction state');
    }

    return new Transaction({
      ...state,
      amounts: { ...state.amounts },
    });
  }

  withPayment(
    providerTransactionId: string,
    status: TransactionStatus,
  ): Transaction {
    if (
      this.state.status !== TRANSACTION_STATUS.pending ||
      providerTransactionId.length === 0
    ) {
      throw new Error('Invalid payment transition');
    }

    return Transaction.restore({
      ...this.state,
      providerTransactionId,
      status,
    });
  }

  failPayment(): Transaction {
    if (this.state.status !== TRANSACTION_STATUS.pending) {
      throw new Error('Invalid payment transition');
    }

    return Transaction.restore({
      ...this.state,
      status: TRANSACTION_STATUS.error,
    });
  }

  releasesStockReservation(): boolean {
    return (
      this.state.status === TRANSACTION_STATUS.declined ||
      this.state.status === TRANSACTION_STATUS.error
    );
  }

  toSnapshot(): TransactionSnapshot {
    return {
      ...this.state,
      amounts: { ...this.state.amounts },
    };
  }
}
