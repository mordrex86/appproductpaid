import { useCallback, useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useAppDispatch, useAppSelector } from './app/hooks';
import { createTransaction, getProduct } from './features/checkout/api';
import {
  checkoutDetailsSaved,
  checkoutReset,
  checkoutStepChanged,
  productLoadFailed,
  productLoadStarted,
  productLoadSucceeded,
  quantityChanged,
  selectCheckout,
  transactionFailed,
  transactionStarted,
  transactionSucceeded,
} from './features/checkout/model/checkoutSlice';
import type {
  CheckoutState,
  CheckoutStep,
} from './features/checkout/model/checkoutSlice';
import {
  cardDigits,
  detectCardBrand,
  formatCardNumber,
  validateCheckoutForm,
} from './features/checkout/validation';
import type {
  CheckoutFormValues,
  FormErrors,
} from './features/checkout/validation';

const currency = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
});

const progressSteps: ReadonlyArray<{
  readonly id: CheckoutStep;
  readonly label: string;
}> = [
  { id: 'product', label: 'Producto' },
  { id: 'payment-and-delivery', label: 'Datos' },
  { id: 'summary', label: 'Resumen' },
  { id: 'result', label: 'Estado' },
];

function formatMoney(amountInPesos: number): string {
  return currency.format(amountInPesos);
}

function Header({ current }: { readonly current: CheckoutStep }) {
  return (
    <header className="site-header">
      <a className="brand" href="/" aria-label="Volver al producto">
        Tienda de audio
      </a>
      <nav aria-label="Progreso de la compra">
        <ol className="progress">
          {progressSteps.map((step) => (
            <li
              className={step.id === current ? 'is-current' : undefined}
              key={step.id}
              aria-current={step.id === current ? 'step' : undefined}
            >
              {step.label}
            </li>
          ))}
        </ol>
      </nav>
      <span className="secure-copy">Compra segura</span>
    </header>
  );
}

function ProductSkeleton() {
  return (
    <main className="product-layout" aria-busy="true" aria-label="Cargando">
      <div className="skeleton product-image-skeleton" />
      <div className="product-copy">
        <div className="skeleton skeleton-line short" />
        <div className="skeleton skeleton-title" />
        <div className="skeleton skeleton-line" />
        <div className="skeleton skeleton-line medium" />
        <div className="skeleton skeleton-button" />
      </div>
    </main>
  );
}

function ProductScreen({
  checkout,
  onContinue,
}: {
  readonly checkout: CheckoutState;
  readonly onContinue: () => void;
}) {
  const dispatch = useAppDispatch();
  const product = checkout.product;

  if (checkout.productStatus === 'loading' || product === undefined) {
    return <ProductSkeleton />;
  }

  return (
    <main className="product-layout">
      <figure className="product-visual">
        <img
          src="/images/wireless-headphones.jpg"
          width="1600"
          height="1063"
          alt="Audífonos inalámbricos color grafito con estuche de carga"
          fetchPriority="high"
        />
      </figure>

      <section className="product-copy" aria-labelledby="product-title">
        <p className="product-category">Audio personal</p>
        <h1 id="product-title">{product.name}</h1>
        <p className="product-description">{product.description}</p>

        <div className="price-row">
          <strong>{formatMoney(product.priceInCents)}</strong>
          <span>
            {product.stock > 0
              ? `${product.stock} unidades disponibles`
              : 'Sin unidades disponibles'}
          </span>
        </div>

        <div className="purchase-controls">
          <label htmlFor="quantity">Cantidad</label>
          <select
            id="quantity"
            value={checkout.quantity}
            onChange={(event) =>
              dispatch(quantityChanged(Number(event.target.value)))
            }
          >
            {Array.from(
              { length: Math.min(product.stock, 10) },
              (_, index) => index + 1,
            ).map((quantity) => (
              <option key={quantity} value={quantity}>
                {quantity}
              </option>
            ))}
          </select>
          <button
            className="primary-button"
            type="button"
            onClick={onContinue}
            disabled={product.stock === 0}
          >
            Pagar con tarjeta
          </button>
        </div>

        <p className="purchase-note">
          El total final incluye tarifa de servicio y envío.
        </p>
      </section>
    </main>
  );
}

function FieldError({
  id,
  message,
}: {
  readonly id: string;
  readonly message: string | undefined;
}) {
  if (message === undefined) return null;
  return (
    <span className="field-error" id={id}>
      {message}
    </span>
  );
}

function PaymentDialog({
  checkout,
  onBack,
}: {
  readonly checkout: CheckoutState;
  readonly onBack: () => void;
}) {
  const dispatch = useAppDispatch();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [errors, setErrors] = useState<FormErrors>({});
  const [values, setValues] = useState<CheckoutFormValues>({
    cardNumber: '',
    cardholder: '',
    expiry: '',
    cvc: '',
    fullName: checkout.customer?.fullName ?? '',
    email: checkout.customer?.email ?? '',
    phone: checkout.customer?.phone ?? '',
    addressLine: checkout.delivery?.addressLine ?? '',
    city: checkout.delivery?.city ?? '',
    region: checkout.delivery?.region ?? '',
    postalCode: checkout.delivery?.postalCode ?? '',
  });
  const brand = detectCardBrand(values.cardNumber);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog !== null && !dialog.open) dialog.showModal();
    return () => {
      if (dialog?.open === true) dialog.close();
    };
  }, []);

  const update = (field: keyof CheckoutFormValues, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => {
      const next = { ...current };
      delete next[field];
      return next;
    });
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors = validateCheckoutForm(values);
    if (Object.keys(nextErrors).length > 0 || brand === undefined) {
      setErrors(nextErrors);
      return;
    }

    dispatch(
      checkoutDetailsSaved({
        customer: {
          fullName: values.fullName.trim(),
          email: values.email.trim(),
          phone: values.phone.replace(/\s/g, ''),
        },
        delivery: {
          addressLine: values.addressLine.trim(),
          city: values.city.trim(),
          region: values.region.trim(),
          postalCode: values.postalCode.trim(),
        },
        card: {
          brand,
          lastFour: cardDigits(values.cardNumber).slice(-4),
        },
        idempotencyKey: crypto.randomUUID(),
      }),
    );
  };

  return (
    <dialog
      className="checkout-dialog"
      ref={dialogRef}
      aria-labelledby="checkout-dialog-title"
      onCancel={(event) => {
        event.preventDefault();
        onBack();
      }}
    >
      <form method="dialog" onSubmit={submit} noValidate>
        <div className="dialog-heading">
          <div>
            <p>Datos de pago y entrega</p>
            <h2 id="checkout-dialog-title">Completa tu compra</h2>
          </div>
          <button className="text-button" type="button" onClick={onBack}>
            Volver
          </button>
        </div>

        <fieldset>
          <legend>Tarjeta</legend>
          <p className="field-note">
            Usa únicamente datos de prueba del entorno Sandbox.
          </p>

          <div className="field full-field">
            <label htmlFor="cardNumber">Número de tarjeta</label>
            <div className="card-number-control">
              <input
                autoFocus
                id="cardNumber"
                name="cardNumber"
                inputMode="numeric"
                autoComplete="cc-number"
                placeholder="0000 0000 0000 0000"
                value={values.cardNumber}
                aria-invalid={errors.cardNumber !== undefined}
                aria-describedby={
                  errors.cardNumber === undefined
                    ? undefined
                    : 'cardNumber-error'
                }
                onChange={(event) =>
                  update('cardNumber', formatCardNumber(event.target.value))
                }
              />
              <span className={`card-brand ${brand ?? ''}`}>
                {brand === 'visa'
                  ? 'VISA'
                  : brand === 'mastercard'
                    ? 'Mastercard'
                    : 'Visa o Mastercard'}
              </span>
            </div>
            <FieldError id="cardNumber-error" message={errors.cardNumber} />
          </div>

          <div className="field full-field">
            <label htmlFor="cardholder">Nombre en la tarjeta</label>
            <input
              id="cardholder"
              name="cardholder"
              autoComplete="cc-name"
              value={values.cardholder}
              aria-invalid={errors.cardholder !== undefined}
              aria-describedby={
                errors.cardholder === undefined ? undefined : 'cardholder-error'
              }
              onChange={(event) => update('cardholder', event.target.value)}
            />
            <FieldError id="cardholder-error" message={errors.cardholder} />
          </div>

          <div className="field">
            <label htmlFor="expiry">Vencimiento</label>
            <input
              id="expiry"
              name="expiry"
              inputMode="numeric"
              autoComplete="cc-exp"
              placeholder="MM/AA"
              maxLength={5}
              value={values.expiry}
              aria-invalid={errors.expiry !== undefined}
              aria-describedby={
                errors.expiry === undefined ? undefined : 'expiry-error'
              }
              onChange={(event) => {
                const digits = event.target.value
                  .replace(/\D/g, '')
                  .slice(0, 4);
                update(
                  'expiry',
                  digits.length > 2
                    ? `${digits.slice(0, 2)}/${digits.slice(2)}`
                    : digits,
                );
              }}
            />
            <FieldError id="expiry-error" message={errors.expiry} />
          </div>

          <div className="field">
            <label htmlFor="cvc">Código de seguridad</label>
            <input
              id="cvc"
              name="cvc"
              type="password"
              inputMode="numeric"
              autoComplete="cc-csc"
              maxLength={3}
              value={values.cvc}
              aria-invalid={errors.cvc !== undefined}
              aria-describedby={
                errors.cvc === undefined ? undefined : 'cvc-error'
              }
              onChange={(event) =>
                update('cvc', event.target.value.replace(/\D/g, '').slice(0, 3))
              }
            />
            <FieldError id="cvc-error" message={errors.cvc} />
          </div>
        </fieldset>

        <fieldset>
          <legend>Entrega</legend>

          <div className="field full-field">
            <label htmlFor="fullName">Nombre de quien recibe</label>
            <input
              id="fullName"
              name="fullName"
              autoComplete="name"
              value={values.fullName}
              aria-invalid={errors.fullName !== undefined}
              aria-describedby={
                errors.fullName === undefined ? undefined : 'fullName-error'
              }
              onChange={(event) => update('fullName', event.target.value)}
            />
            <FieldError id="fullName-error" message={errors.fullName} />
          </div>

          <div className="field">
            <label htmlFor="email">Correo</label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              value={values.email}
              aria-invalid={errors.email !== undefined}
              aria-describedby={
                errors.email === undefined ? undefined : 'email-error'
              }
              onChange={(event) => update('email', event.target.value)}
            />
            <FieldError id="email-error" message={errors.email} />
          </div>

          <div className="field">
            <label htmlFor="phone">Teléfono</label>
            <input
              id="phone"
              name="phone"
              type="tel"
              autoComplete="tel"
              placeholder="+57 300 123 4567"
              value={values.phone}
              aria-invalid={errors.phone !== undefined}
              aria-describedby={
                errors.phone === undefined ? undefined : 'phone-error'
              }
              onChange={(event) => update('phone', event.target.value)}
            />
            <FieldError id="phone-error" message={errors.phone} />
          </div>

          <div className="field full-field">
            <label htmlFor="addressLine">Dirección</label>
            <input
              id="addressLine"
              name="addressLine"
              autoComplete="street-address"
              value={values.addressLine}
              aria-invalid={errors.addressLine !== undefined}
              aria-describedby={
                errors.addressLine === undefined
                  ? undefined
                  : 'addressLine-error'
              }
              onChange={(event) => update('addressLine', event.target.value)}
            />
            <FieldError id="addressLine-error" message={errors.addressLine} />
          </div>

          <div className="field">
            <label htmlFor="city">Ciudad</label>
            <input
              id="city"
              name="city"
              autoComplete="address-level2"
              value={values.city}
              aria-invalid={errors.city !== undefined}
              aria-describedby={
                errors.city === undefined ? undefined : 'city-error'
              }
              onChange={(event) => update('city', event.target.value)}
            />
            <FieldError id="city-error" message={errors.city} />
          </div>

          <div className="field">
            <label htmlFor="region">Departamento</label>
            <input
              id="region"
              name="region"
              autoComplete="address-level1"
              value={values.region}
              aria-invalid={errors.region !== undefined}
              aria-describedby={
                errors.region === undefined ? undefined : 'region-error'
              }
              onChange={(event) => update('region', event.target.value)}
            />
            <FieldError id="region-error" message={errors.region} />
          </div>

          <div className="field">
            <label htmlFor="postalCode">Código postal</label>
            <input
              id="postalCode"
              name="postalCode"
              autoComplete="postal-code"
              value={values.postalCode}
              aria-invalid={errors.postalCode !== undefined}
              aria-describedby={
                errors.postalCode === undefined ? undefined : 'postalCode-error'
              }
              onChange={(event) => update('postalCode', event.target.value)}
            />
            <FieldError id="postalCode-error" message={errors.postalCode} />
          </div>
        </fieldset>

        <div className="dialog-actions">
          <p>La tarjeta y el CVC no se guardan en este dispositivo.</p>
          <button className="primary-button" type="submit">
            Revisar compra
          </button>
        </div>
      </form>
    </dialog>
  );
}

function SummaryScreen({
  checkout,
  onConfirm,
}: {
  readonly checkout: CheckoutState;
  readonly onConfirm: () => void;
}) {
  const dispatch = useAppDispatch();
  const { product, customer, delivery, card } = checkout;

  if (
    product === undefined ||
    customer === undefined ||
    delivery === undefined ||
    card === undefined
  ) {
    return (
      <main className="message-layout">
        <h1>Faltan datos para continuar</h1>
        <p>Vuelve al producto y completa nuevamente la información.</p>
        <button
          className="primary-button"
          type="button"
          onClick={() => dispatch(checkoutReset())}
        >
          Volver al producto
        </button>
      </main>
    );
  }

  const estimate = {
    product: product.priceInCents * checkout.quantity,
    baseFee: 2_000,
    deliveryFee: 8_000,
  };
  const total = estimate.product + estimate.baseFee + estimate.deliveryFee;

  return (
    <main className="summary-layout">
      <section className="summary-main" aria-labelledby="summary-title">
        <button
          className="text-button"
          type="button"
          onClick={() => dispatch(checkoutStepChanged('payment-and-delivery'))}
        >
          Editar datos
        </button>
        <h1 id="summary-title">Revisa antes de pagar</h1>
        <p className="summary-intro">
          El backend volverá a calcular todos los valores antes de crear la
          transacción.
        </p>

        <div className="summary-product">
          <img
            src="/images/wireless-headphones.jpg"
            width="1600"
            height="1063"
            alt=""
          />
          <div>
            <strong>{product.name}</strong>
            <span>Cantidad: {checkout.quantity}</span>
          </div>
        </div>

        <div className="detail-columns">
          <section>
            <h2>Entrega</h2>
            <address>
              {customer.fullName}
              <br />
              {delivery.addressLine}
              <br />
              {delivery.city}, {delivery.region}
              <br />
              {delivery.postalCode}
            </address>
          </section>
          <section>
            <h2>Pago</h2>
            <p>
              {card.brand === 'visa' ? 'Visa' : 'Mastercard'} terminada en{' '}
              {card.lastFour}
            </p>
            <p>{customer.email}</p>
          </section>
        </div>
      </section>

      <aside className="totals" aria-label="Totales de la compra">
        <h2>Total estimado</h2>
        <dl>
          <div>
            <dt>Producto</dt>
            <dd>{formatMoney(estimate.product)}</dd>
          </div>
          <div>
            <dt>Tarifa de servicio</dt>
            <dd>{formatMoney(estimate.baseFee)}</dd>
          </div>
          <div>
            <dt>Envío</dt>
            <dd>{formatMoney(estimate.deliveryFee)}</dd>
          </div>
          <div className="total-row">
            <dt>Total</dt>
            <dd>{formatMoney(total)}</dd>
          </div>
        </dl>

        {checkout.transactionError !== undefined && (
          <p className="request-error" role="alert">
            {checkout.transactionError}
          </p>
        )}

        <button
          className="primary-button"
          type="button"
          onClick={onConfirm}
          disabled={checkout.transactionStatus === 'loading'}
        >
          {checkout.transactionStatus === 'loading'
            ? 'Creando transacción...'
            : 'Confirmar pago'}
        </button>
      </aside>
    </main>
  );
}

function ResultScreen({ checkout }: { readonly checkout: CheckoutState }) {
  const dispatch = useAppDispatch();
  const transaction = checkout.transaction;

  if (transaction === undefined) {
    return (
      <main className="message-layout">
        <h1>No encontramos la transacción</h1>
        <p>Puedes volver al producto e iniciar nuevamente.</p>
        <button
          className="primary-button"
          type="button"
          onClick={() => dispatch(checkoutReset())}
        >
          Volver al producto
        </button>
      </main>
    );
  }

  return (
    <main className="result-layout">
      <div className="status-mark" aria-hidden="true">
        P
      </div>
      <p className="result-status">Transacción pendiente</p>
      <h1>Recibimos tu solicitud</h1>
      <p>
        La transacción fue creada correctamente. El pago Sandbox se conectará en
        el siguiente incremento.
      </p>
      <dl>
        <div>
          <dt>Referencia</dt>
          <dd>{transaction.id}</dd>
        </div>
        <div>
          <dt>Total calculado</dt>
          <dd>{formatMoney(transaction.amounts.total)}</dd>
        </div>
      </dl>
      <button
        className="primary-button"
        type="button"
        onClick={() => dispatch(checkoutReset())}
      >
        Volver al producto
      </button>
    </main>
  );
}

function ProductError({
  message,
  onRetry,
}: {
  readonly message: string;
  readonly onRetry: () => void;
}) {
  return (
    <main className="message-layout">
      <h1>No pudimos cargar el producto</h1>
      <p role="alert">{message}</p>
      <button className="primary-button" type="button" onClick={onRetry}>
        Intentar nuevamente
      </button>
    </main>
  );
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
          error instanceof Error
            ? error.message
            : 'No fue posible cargar el producto.',
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
    const { product, customer, delivery, idempotencyKey } = checkout;
    if (
      product === undefined ||
      customer === undefined ||
      delivery === undefined ||
      idempotencyKey === undefined
    ) {
      dispatch(transactionFailed('Faltan datos para crear la transacción.'));
      return;
    }

    dispatch(transactionStarted());
    try {
      dispatch(
        transactionSucceeded(
          await createTransaction({
            idempotencyKey,
            productId: product.id,
            quantity: checkout.quantity,
            customer,
            delivery,
          }),
        ),
      );
    } catch (error) {
      dispatch(
        transactionFailed(
          error instanceof Error
            ? error.message
            : 'No fue posible crear la transacción.',
        ),
      );
    }
  };

  const showProduct =
    checkout.step === 'product' || checkout.step === 'payment-and-delivery';

  return (
    <div className="app-shell">
      <Header current={checkout.step} />

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
          {checkout.step === 'result' && <ResultScreen checkout={checkout} />}
        </>
      )}
    </div>
  );
}

export default App;
