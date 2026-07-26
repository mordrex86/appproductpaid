import { configureStore } from '@reduxjs/toolkit';
import checkoutReducer, {
  checkoutDetailsSaved,
  checkoutReset,
  checkoutStepChanged,
  productLoadFailed,
  productLoadStarted,
  productLoadSucceeded,
  quantityChanged,
  selectCheckoutStep,
  transactionFailed,
  transactionStarted,
  transactionSucceeded,
} from './checkoutSlice';

const product = {
  id: 'wireless-headphones',
  name: 'Audífonos inalámbricos',
  description: 'Descripción',
  priceInCents: 129_900,
  stock: 12,
};

const transaction = {
  id: 'transaction-1',
  productId: product.id,
  customerId: 'customer-1',
  quantity: 1,
  status: 'PENDING' as const,
  amounts: {
    product: 129_900,
    baseFee: 2_000,
    deliveryFee: 8_000,
    total: 139_900,
  },
  createdAt: '2026-07-26T00:00:00.000Z',
};

const createTestStore = () =>
  configureStore({
    reducer: {
      checkout: checkoutReducer,
    },
  });

describe('checkoutSlice', () => {
  it('loads the product and changes quantity', () => {
    const store = createTestStore();

    store.dispatch(productLoadStarted());
    expect(store.getState().checkout.productStatus).toBe('loading');

    store.dispatch(productLoadSucceeded(product));
    store.dispatch(quantityChanged(2));

    expect(store.getState().checkout).toMatchObject({
      product,
      productStatus: 'succeeded',
      quantity: 2,
    });
  });

  it('moves through details and transaction states', () => {
    const store = createTestStore();
    store.dispatch(checkoutStepChanged('payment-and-delivery'));
    store.dispatch(
      checkoutDetailsSaved({
        customer: {
          fullName: 'Laura Medina',
          email: 'laura@example.com',
          phone: '+573001234567',
        },
        delivery: {
          addressLine: 'Calle 10 # 20-30',
          city: 'Bogotá',
          region: 'Cundinamarca',
          postalCode: '110111',
        },
        card: { brand: 'visa', lastFour: '4242' },
        idempotencyKey: 'checkout-attempt-0001',
      }),
    );
    store.dispatch(transactionStarted());
    store.dispatch(transactionFailed('No disponible'));
    store.dispatch(transactionStarted());
    store.dispatch(transactionSucceeded(transaction));

    expect(selectCheckoutStep(store.getState())).toBe('result');
    expect(store.getState().checkout.transaction).toEqual(transaction);
  });

  it('records product errors and resets while preserving a loaded product', () => {
    const store = createTestStore();
    store.dispatch(productLoadStarted());
    store.dispatch(productLoadFailed('No disponible'));
    expect(store.getState().checkout.productError).toBe('No disponible');

    store.dispatch(productLoadSucceeded(product));
    store.dispatch(checkoutStepChanged('result'));
    store.dispatch(checkoutReset());

    expect(store.getState().checkout).toMatchObject({
      step: 'product',
      product,
      productStatus: 'succeeded',
    });
  });

  it('resets to idle when no product was loaded', () => {
    const store = createTestStore();
    store.dispatch(checkoutStepChanged('summary'));
    store.dispatch(checkoutReset());

    expect(store.getState().checkout.productStatus).toBe('idle');
  });
});
