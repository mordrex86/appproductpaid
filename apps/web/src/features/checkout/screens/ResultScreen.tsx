import { useAppDispatch } from '../../../app/hooks';
import { checkoutReset } from '../model/checkoutSlice';
import type { CheckoutState } from '../model/checkoutSlice';
import { formatMoney } from '../formatMoney';

export function ResultScreen({
  checkout,
  onRefresh,
}: {
  readonly checkout: CheckoutState;
  readonly onRefresh: () => void;
}) {
  const dispatch = useAppDispatch();
  const transaction = checkout.transaction;

  if (transaction === undefined) {
    return (
      <main className="message-layout">
        <h1>No encontramos tu compra</h1>
        <p>Puedes volver a la tienda e intentarlo nuevamente.</p>
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

  const copy = {
    PENDING: {
      mark: 'P',
      status: 'Pago pendiente',
      title: 'Estamos confirmando tu pago',
      description:
        'La confirmación puede tardar unos segundos. Puedes consultar nuevamente.',
    },
    APPROVED: {
      mark: 'A',
      status: 'Pago aprobado',
      title: 'Tu compra fue aprobada',
      description:
        'Tu pedido quedó confirmado y será preparado para la entrega.',
    },
    DECLINED: {
      mark: 'R',
      status: 'Pago rechazado',
      title: 'El pago no fue aprobado',
      description:
        'No se realizó ningún cobro. Puedes volver e intentar con otra tarjeta.',
    },
    ERROR: {
      mark: 'E',
      status: 'Error de pago',
      title: 'No pudimos completar el pago',
      description:
        'Ocurrió un problema al procesar la transacción. Intenta nuevamente.',
    },
  }[transaction.status];

  return (
    <main className="result-layout">
      <div className="status-mark" aria-hidden="true">
        {copy.mark}
      </div>
      <p className="result-status">{copy.status}</p>
      <h1>{copy.title}</h1>
      <p>{copy.description}</p>
      <dl>
        <div>
          <dt>Referencia</dt>
          <dd>{transaction.id}</dd>
        </div>
        <div>
          <dt>Total</dt>
          <dd>{formatMoney(transaction.amounts.total)}</dd>
        </div>
      </dl>
      {checkout.transactionError !== undefined && (
        <p className="request-error" role="alert">
          {checkout.transactionError}
        </p>
      )}
      {transaction.status === 'PENDING' && (
        <button
          className="primary-button"
          type="button"
          onClick={onRefresh}
          disabled={checkout.transactionStatus === 'loading'}
        >
          {checkout.transactionStatus === 'loading'
            ? 'Consultando...'
            : 'Consultar estado'}
        </button>
      )}
      <button
        className="text-button"
        type="button"
        onClick={() => dispatch(checkoutReset())}
      >
        Volver al producto
      </button>
    </main>
  );
}
