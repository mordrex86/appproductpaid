import { useAppSelector } from './app/hooks';
import { selectCheckoutStep } from './features/checkout/model/checkoutSlice';

function App() {
  const checkoutStep = useAppSelector(selectCheckoutStep);

  return (
    <main className="app-shell">
      <section className="status-card" aria-labelledby="project-title">
        <p className="eyebrow">Product payment application</p>
        <h1 id="project-title">Base técnica preparada</h1>
        <p>
          React, Redux Toolkit y NestJS están configurados para comenzar el
          flujo de compra.
        </p>
        <dl>
          <div>
            <dt>Etapa inicial</dt>
            <dd>{checkoutStep}</dd>
          </div>
          <div>
            <dt>API</dt>
            <dd>/api/v1</dd>
          </div>
        </dl>
      </section>
    </main>
  );
}

export default App;
