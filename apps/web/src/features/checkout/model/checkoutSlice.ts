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

interface CheckoutState {
  readonly step: CheckoutStep;
}

const initialState: CheckoutState = {
  step: 'product',
};

const checkoutSlice = createSlice({
  name: 'checkout',
  initialState,
  reducers: {
    checkoutReset: () => initialState,
    checkoutStepChanged: (state, action: PayloadAction<CheckoutStep>) => {
      state.step = action.payload;
    },
  },
});

export const { checkoutReset, checkoutStepChanged } = checkoutSlice.actions;
export const selectCheckoutStep = (state: RootState): CheckoutStep =>
  state.checkout.step;
export default checkoutSlice.reducer;
