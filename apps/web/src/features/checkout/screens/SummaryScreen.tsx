import { useAppDispatch } from '../../../app/hooks';
import { checkoutReset, checkoutStepChanged } from '../model/checkoutSlice';
import type { CheckoutState } from '../model/checkoutSlice';
import { formatMoney } from '../formatMoney';

export function SummaryScreen({
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

  const productAmount = product.priceInCents * checkout.quantity;
  const baseFee = 200_000;
  const deliveryFee = 800_000;
  const total = productAmount + baseFee + deliveryFee;

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
          Verifica tus datos y el total. Al confirmar, procesaremos el pago de
          forma segura.
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
            <h2>Pago y contacto</h2>
            <p>
              {card.brand === 'visa' ? 'Visa' : 'Mastercard'} terminada en{' '}
              {card.lastFour}
            </p>
            <p>{customer.email}</p>
            <p>{customer.phone}</p>
          </section>
        </div>
      </section>

      <aside className="totals" aria-label="Totales de la compra">
        <h2>Total estimado</h2>
        <dl>
          <div>
            <dt>Producto</dt>
            <dd>{formatMoney(productAmount)}</dd>
          </div>
          <div>
            <dt>Tarifa de servicio</dt>
            <dd>{formatMoney(baseFee)}</dd>
          </div>
          <div>
            <dt>Envío</dt>
            <dd>{formatMoney(deliveryFee)}</dd>
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
            ? 'Procesando pago...'
            : 'Confirmar pago'}
        </button>
      </aside>
    </main>
  );
}
