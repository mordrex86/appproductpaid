import { configureStore } from '@reduxjs/toolkit';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import App from './App';
import checkoutReducer, {
  initialState,
} from './features/checkout/model/checkoutSlice';

const product = {
  id: 'wireless-headphones',
  name: 'Audífonos inalámbricos',
  description: 'Audífonos bluetooth con estuche de carga.',
  priceInCents: 12_990_000,
  stock: 12,
};

const transaction = {
  id: 'transaction-1',
  productId: product.id,
  customerId: 'customer-1',
  quantity: 1,
  status: 'APPROVED',
  providerTransactionId: 'wompi-1',
  amounts: {
    product: 12_990_000,
    baseFee: 200_000,
    deliveryFee: 800_000,
    total: 13_990_000,
  },
  createdAt: '2026-07-26T00:00:00.000Z',
};

const paymentConfiguration = {
  publicKey: 'pub_test_123',
  tokenizationUrl: 'https://sandbox.example/tokens/cards',
  terms: {
    acceptanceToken: 'acceptance-token',
    permalink: 'https://sandbox.example/terms',
  },
  personalData: {
    acceptanceToken: 'personal-data-token',
    permalink: 'https://sandbox.example/privacy',
  },
};

function response(body: unknown, status = 200) {
  return {
    json: jest.fn().mockResolvedValue(body),
    ok: status >= 200 && status < 300,
    status,
  } as unknown as Response;
}

function createTestStore(checkout = initialState) {
  return configureStore({
    reducer: { checkout: checkoutReducer },
    preloadedState: { checkout },
  });
}

function renderApp(checkout = initialState) {
  const store = createTestStore(checkout);
  render(
    <Provider store={store}>
      <App />
    </Provider>,
  );
  return store;
}

function completeForm() {
  fireEvent.change(screen.getByLabelText('Número de tarjeta'), {
    target: { value: '4242424242424242' },
  });
  fireEvent.change(screen.getByLabelText('Nombre en la tarjeta'), {
    target: { value: 'Laura Medina' },
  });
  fireEvent.change(screen.getByLabelText('Vencimiento'), {
    target: { value: '1299' },
  });
  fireEvent.change(screen.getByLabelText('Código de seguridad'), {
    target: { value: '123' },
  });
  fireEvent.change(screen.getByLabelText('Nombre de quien recibe'), {
    target: { value: 'Laura Medina' },
  });
  fireEvent.change(screen.getByLabelText('Correo'), {
    target: { value: 'laura@example.com' },
  });
  fireEvent.change(screen.getByLabelText('Teléfono'), {
    target: { value: '3001234567' },
  });
  fireEvent.change(screen.getByLabelText('Dirección'), {
    target: { value: 'Calle 10 # 20-30' },
  });
  fireEvent.change(screen.getByLabelText('Ciudad'), {
    target: { value: 'Bogotá' },
  });
  fireEvent.change(screen.getByLabelText('Departamento'), {
    target: { value: 'Cundinamarca' },
  });
  fireEvent.change(screen.getByLabelText('Código postal'), {
    target: { value: '110111' },
  });
  fireEvent.click(screen.getByLabelText(/Acepto los/));
  fireEvent.click(screen.getByLabelText(/Autorizo el/));
}

describe('checkout application', () => {
  beforeEach(() => {
    (globalThis.fetch as jest.Mock).mockReset();
  });

  it('loads and presents the product', async () => {
    (globalThis.fetch as jest.Mock).mockResolvedValue(response(product));
    renderApp();

    expect(
      await screen.findByRole('heading', {
        name: 'Audífonos inalámbricos',
      }),
    ).toBeInTheDocument();
    expect(screen.getByText('12 unidades disponibles')).toBeInTheDocument();
    expect(screen.getByText(/129\.900/)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Pagar con tarjeta' }),
    ).toBeEnabled();
  });

  it('completes the five observable stages', async () => {
    (globalThis.fetch as jest.Mock)
      .mockResolvedValueOnce(response(product))
      .mockResolvedValueOnce(response(paymentConfiguration))
      .mockResolvedValueOnce(response({ data: { id: 'tok_test_123' } }))
      .mockResolvedValueOnce(
        response({ ...transaction, status: 'PENDING' }, 201),
      )
      .mockResolvedValueOnce(response(transaction));
    renderApp();

    await screen.findByRole('heading', { name: product.name });
    fireEvent.click(screen.getByRole('button', { name: 'Pagar con tarjeta' }));
    expect(
      screen.getByRole('heading', { name: 'Completa tu compra' }),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Revisar compra' }),
      ).toBeEnabled(),
    );

    completeForm();
    expect(screen.getByText('VISA')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Revisar compra' }));

    expect(
      await screen.findByRole('heading', { name: 'Revisa antes de pagar' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Visa terminada en 4242')).toBeInTheDocument();
    expect(screen.getByText('+573001234567')).toBeInTheDocument();
    expect(screen.queryByText(/backend/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Confirmar pago' }));
    expect(
      await screen.findByRole('heading', {
        name: 'Tu compra fue aprobada',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Tu pedido quedó confirmado y será preparado para la entrega.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('transaction-1')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Volver al producto' }));
    expect(
      screen.getByRole('heading', { name: product.name }),
    ).toBeInTheDocument();
    expect(screen.getByText('11 unidades disponibles')).toBeInTheDocument();
  });

  it('shows form validation and allows returning to the product', async () => {
    (globalThis.fetch as jest.Mock)
      .mockResolvedValueOnce(response(product))
      .mockResolvedValueOnce(response(paymentConfiguration));
    renderApp();

    await screen.findByRole('heading', { name: product.name });
    fireEvent.click(screen.getByRole('button', { name: 'Pagar con tarjeta' }));
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Revisar compra' }),
      ).toBeEnabled(),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Revisar compra' }));

    expect(
      screen.getByText('Ingresa una tarjeta Visa o Mastercard válida.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Completa la dirección de entrega.'),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Volver' }));
    await waitFor(() =>
      expect(
        screen.queryByRole('heading', { name: 'Completa tu compra' }),
      ).not.toBeInTheDocument(),
    );
  });

  it('recovers after a product request fails', async () => {
    (globalThis.fetch as jest.Mock)
      .mockResolvedValueOnce(response({ message: 'Servicio temporal' }, 503))
      .mockResolvedValueOnce(response(product));
    renderApp();

    expect(
      await screen.findByRole('heading', {
        name: 'No pudimos cargar el producto',
      }),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('button', { name: 'Intentar nuevamente' }),
    );

    expect(
      await screen.findByRole('heading', { name: product.name }),
    ).toBeInTheDocument();
  });

  it('recovers from incomplete restored progress', async () => {
    (globalThis.fetch as jest.Mock).mockResolvedValue(response(product));
    renderApp({ ...initialState, step: 'summary' });

    expect(
      screen.getByRole('heading', { name: 'Faltan datos para continuar' }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Volver al producto' }));
    expect(
      await screen.findByRole('heading', { name: product.name }),
    ).toBeInTheDocument();
  });

  it('handles a restored result without a transaction', async () => {
    (globalThis.fetch as jest.Mock).mockResolvedValue(response(product));
    renderApp({ ...initialState, step: 'result' });

    expect(
      screen.getByRole('heading', { name: 'No encontramos tu compra' }),
    ).toBeInTheDocument();
  });
});
