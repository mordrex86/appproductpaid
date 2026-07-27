import { useCallback, useEffect, useRef } from 'react';
import { useAppDispatch, useAppSelector } from './app/hooks';
import {
  createTransaction,
  getProduct,
  startPayment,
  syncPayment,
} from './features/checkout/api';
import { CheckoutHeader } from './features/checkout/components/CheckoutHeader';
import {
  checkoutStepChanged,
  productLoadFailed,
  productLoadStarted,
  productLoadSucceeded,
  selectCheckout,
  transactionFailed,
  transactionStarted,
  transactionSucceeded,
} from './features/checkout/model/checkoutSlice';
import {
  ProductError,
  ProductScreen,
} from './features/checkout/screens/ProductScreen';
import { PaymentDialog } from './features/checkout/screens/PaymentDialog';
import { ResultScreen } from './features/checkout/screens/ResultScreen';
import { SummaryScreen } from './features/checkout/screens/SummaryScreen';

const paymentStatusAttempts = 5;
const paymentStatusDelay = 1_500;

async function waitForPaymentResult(transactionId: string) {
  let result = await syncPayment(transactionId);

  for (
    let attempt = 1;
    attempt < paymentStatusAttempts && result.status === 'PENDING';
    attempt++
  ) {
    await new Promise((resolve) => setTimeout(resolve, paymentStatusDelay));
    result = await syncPayment(transactionId);
  }

  return result;
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function App() {
  const dispatch = useAppDispatch();
  const checkout = useAppSelector(selectCheckout);
  const requestedProduct = useRef(false);

  const loadProduct = useCallback(async () => {
    dispatch(productLoadStarted());
    try {
      dispatch(productLoadSucceeded(await getProduct()));
    } catch (error) {
      dispatch(
        productLoadFailed(
          errorMessage(error, 'No fue posible cargar el producto.'),
        ),
      );
    }
  }, [dispatch]);

  useEffect(() => {
    if (!requestedProduct.current) {
      requestedProduct.current = true;
      void loadProduct();
    }
  }, [loadProduct]);

  const confirmTransaction = async () => {
    const {
      product,
      customer,
      delivery,
      idempotencyKey,
      paymentAuthorization,
    } = checkout;
    if (
      product === undefined ||
      customer === undefined ||
      delivery === undefined ||
      idempotencyKey === undefined ||
      paymentAuthorization === undefined
    ) {
      dispatch(transactionFailed('Faltan datos para crear la transacción.'));
      return;
    }

    dispatch(transactionStarted());
    try {
      const pending = await createTransaction({
        idempotencyKey,
        productId: product.id,
        quantity: checkout.quantity,
        customer,
        delivery,
      });
      const started = await startPayment(pending.id, paymentAuthorization);
      const result =
        started.status === 'PENDING'
          ? await waitForPaymentResult(started.id)
          : started;
      dispatch(transactionSucceeded(result));
    } catch (error) {
      dispatch(
        transactionFailed(
          errorMessage(error, 'No fue posible crear la transacción.'),
        ),
      );
    }
  };

  const refreshTransaction = async () => {
    if (checkout.transaction === undefined) return;
    dispatch(transactionStarted());
    try {
      dispatch(
        transactionSucceeded(await syncPayment(checkout.transaction.id)),
      );
    } catch (error) {
      dispatch(
        transactionFailed(
          errorMessage(error, 'No fue posible consultar la transacción.'),
        ),
      );
    }
  };

  const showProduct =
    checkout.step === 'product' || checkout.step === 'payment-and-delivery';

  return (
    <div className="app-shell">
      <CheckoutHeader current={checkout.step} />

      {checkout.productStatus === 'failed' ? (
        <ProductError
          message={
            checkout.productError ?? 'No fue posible cargar el producto.'
          }
          onRetry={() => void loadProduct()}
        />
      ) : (
        <>
          {showProduct && (
            <ProductScreen
              checkout={checkout}
              onContinue={() =>
                dispatch(checkoutStepChanged('payment-and-delivery'))
              }
            />
          )}
          {checkout.step === 'payment-and-delivery' && (
            <PaymentDialog
              checkout={checkout}
              onBack={() => dispatch(checkoutStepChanged('product'))}
            />
          )}
          {checkout.step === 'summary' && (
            <SummaryScreen
              checkout={checkout}
              onConfirm={() => void confirmTransaction()}
            />
          )}
          {checkout.step === 'result' && (
            <ResultScreen
              checkout={checkout}
              onRefresh={() => void refreshTransaction()}
            />
          )}
        </>
      )}
    </div>
  );
}

export default App;
