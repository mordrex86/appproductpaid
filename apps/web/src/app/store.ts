import { configureStore } from '@reduxjs/toolkit';
import checkoutReducer from '../features/checkout/model/checkoutSlice';

export const store = configureStore({
  reducer: {
    checkout: checkoutReducer,
  },
});

export type AppDispatch = typeof store.dispatch;
export type RootState = ReturnType<typeof store.getState>;
