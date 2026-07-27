import { configureStore } from '@reduxjs/toolkit';
import checkoutReducer, {
  checkoutSteps,
  initialState,
} from '../features/checkout/model/checkoutSlice';
import type {
  CheckoutState,
  CheckoutStep,
} from '../features/checkout/model/checkoutSlice';

const STORAGE_KEY = 'checkout-progress-v1';

function isCheckoutStep(value: unknown): value is CheckoutStep {
  return checkoutSteps.includes(value as CheckoutStep);
}

export function loadCheckoutState(): CheckoutState {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw === null) return initialState;

    const value = JSON.parse(raw) as Partial<CheckoutState>;
    if (!isCheckoutStep(value.step)) return initialState;
    const restoredStep = value.step;
    const { paymentAuthorization, ...safeValue } = value;
    void paymentAuthorization;

    return {
      ...initialState,
      ...safeValue,
      step: restoredStep === 'summary' ? 'payment-and-delivery' : restoredStep,
      productStatus: 'idle',
      transactionStatus: 'idle',
    };
  } catch {
    return initialState;
  }
}

export const store = configureStore({
  reducer: {
    checkout: checkoutReducer,
  },
  preloadedState: {
    checkout: loadCheckoutState(),
  },
});

store.subscribe(() => {
  const {
    step,
    quantity,
    customer,
    delivery,
    card,
    idempotencyKey,
    transaction,
  } = store.getState().checkout;

  sessionStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      step,
      quantity,
      customer,
      delivery,
      card,
      idempotencyKey,
      transaction,
    }),
  );
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
