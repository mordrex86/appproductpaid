import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from '../../../app/store';

export const checkoutSteps = [
  'product',
  'payment-and-delivery',
  'summary',
  'result',
] as const;

export type CheckoutStep = (typeof checkoutSteps)[number];
export type AsyncStatus = 'idle' | 'loading' | 'succeeded' | 'failed';
export type CardBrand = 'visa' | 'mastercard';

export interface Product {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly priceInCents: number;
  readonly stock: number;
}

export interface Customer {
  readonly fullName: string;
  readonly email: string;
  readonly phone: string;
}

export interface Delivery {
  readonly addressLine: string;
  readonly city: string;
  readonly region: string;
  readonly postalCode: string;
}

export interface CardSummary {
  readonly brand: CardBrand;
  readonly lastFour: string;
}

export interface PaymentAuthorization {
  readonly paymentToken: string;
  readonly acceptanceToken: string;
  readonly personalDataToken: string;
}

export interface Transaction {
  readonly id: string;
  readonly productId: string;
  readonly customerId: string;
  readonly quantity: number;
  readonly status: 'PENDING' | 'APPROVED' | 'DECLINED' | 'ERROR';
  readonly providerTransactionId?: string;
  readonly amounts: {
    readonly product: number;
    readonly baseFee: number;
    readonly deliveryFee: number;
    readonly total: number;
  };
  readonly createdAt: string;
}

export interface CheckoutState {
  readonly step: CheckoutStep;
  readonly quantity: number;
  readonly product?: Product;
  readonly productStatus: AsyncStatus;
  readonly productError?: string;
  readonly customer?: Customer;
  readonly delivery?: Delivery;
  readonly card?: CardSummary;
  readonly paymentAuthorization?: PaymentAuthorization;
  readonly idempotencyKey?: string;
  readonly transaction?: Transaction;
  readonly transactionStatus: AsyncStatus;
  readonly transactionError?: string;
}

export const initialState: CheckoutState = {
  step: 'product',
  quantity: 1,
  productStatus: 'idle',
  transactionStatus: 'idle',
};

const checkoutSlice = createSlice({
  name: 'checkout',
  initialState,
  reducers: {
    productLoadStarted: (state) => {
      state.productStatus = 'loading';
      delete state.productError;
    },
    productLoadSucceeded: (state, action: PayloadAction<Product>) => {
      state.product = action.payload;
      state.productStatus = 'succeeded';
    },
    productLoadFailed: (state, action: PayloadAction<string>) => {
      state.productStatus = 'failed';
      state.productError = action.payload;
    },
    quantityChanged: (state, action: PayloadAction<number>) => {
      state.quantity = action.payload;
    },
    checkoutStepChanged: (state, action: PayloadAction<CheckoutStep>) => {
      state.step = action.payload;
      delete state.transactionError;
    },
    checkoutDetailsSaved: (
      state,
      action: PayloadAction<{
        customer: Customer;
        delivery: Delivery;
        card: CardSummary;
        paymentAuthorization: PaymentAuthorization;
        idempotencyKey: string;
      }>,
    ) => {
      state.customer = action.payload.customer;
      state.delivery = action.payload.delivery;
      state.card = action.payload.card;
      state.paymentAuthorization = action.payload.paymentAuthorization;
      state.idempotencyKey = action.payload.idempotencyKey;
      state.step = 'summary';
    },
    transactionStarted: (state) => {
      state.transactionStatus = 'loading';
      delete state.transactionError;
    },
    transactionSucceeded: (state, action: PayloadAction<Transaction>) => {
      state.transaction = action.payload;
      if (
        action.payload.status === 'APPROVED' &&
        state.product !== undefined &&
        state.transaction?.status !== 'APPROVED'
      ) {
        state.product.stock -= action.payload.quantity;
      }
      state.transactionStatus = 'succeeded';
      state.step = 'result';
    },
    transactionFailed: (state, action: PayloadAction<string>) => {
      state.transactionStatus = 'failed';
      state.transactionError = action.payload;
    },
    checkoutReset: (state) => {
      const product = state.product;
      Object.assign(state, initialState);
      if (product !== undefined) {
        state.product = product;
        state.productStatus = 'succeeded';
      }
    },
  },
});

export const {
  checkoutDetailsSaved,
  checkoutReset,
  checkoutStepChanged,
  productLoadFailed,
  productLoadStarted,
  productLoadSucceeded,
  quantityChanged,
  transactionFailed,
  transactionStarted,
  transactionSucceeded,
} = checkoutSlice.actions;

export const selectCheckout = (state: RootState): CheckoutState =>
  state.checkout;
export const selectCheckoutStep = (state: RootState): CheckoutStep =>
  state.checkout.step;

export default checkoutSlice.reducer;
