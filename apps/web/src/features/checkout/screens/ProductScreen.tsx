import { useAppDispatch } from '../../../app/hooks';
import { quantityChanged } from '../model/checkoutSlice';
import type { CheckoutState } from '../model/checkoutSlice';
import { formatMoney } from '../formatMoney';

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

export function ProductScreen({
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

export function ProductError({
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
