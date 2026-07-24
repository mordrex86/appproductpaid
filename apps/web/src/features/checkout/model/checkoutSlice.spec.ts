import { configureStore } from '@reduxjs/toolkit';
import checkoutReducer, {
  checkoutReset,
  checkoutStepChanged,
  selectCheckoutStep,
} from './checkoutSlice';

const createTestStore = () =>
  configureStore({
    reducer: {
      checkout: checkoutReducer,
    },
  });

describe('checkoutSlice', () => {
  it('starts at the product step', () => {
    const store = createTestStore();

    expect(selectCheckoutStep(store.getState())).toBe('product');
  });

  it('changes the current checkout step', () => {
    const store = createTestStore();

    store.dispatch(checkoutStepChanged('summary'));

    expect(selectCheckoutStep(store.getState())).toBe('summary');
  });

  it('resets the checkout flow', () => {
    const store = createTestStore();
    store.dispatch(checkoutStepChanged('result'));

    store.dispatch(checkoutReset());

    expect(selectCheckoutStep(store.getState())).toBe('product');
  });
});
