import type { CheckoutStep } from '../model/checkoutSlice';

const progressSteps: ReadonlyArray<{
  readonly id: CheckoutStep;
  readonly label: string;
}> = [
  { id: 'product', label: 'Producto' },
  { id: 'payment-and-delivery', label: 'Datos' },
  { id: 'summary', label: 'Resumen' },
  { id: 'result', label: 'Estado' },
];

export function CheckoutHeader({
  current,
}: {
  readonly current: CheckoutStep;
}) {
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
