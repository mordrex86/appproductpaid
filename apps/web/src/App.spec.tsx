import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { store } from './app/store';
import App from './App';

describe('App', () => {
  it('shows the project base and initial checkout step', () => {
    render(
      <Provider store={store}>
        <App />
      </Provider>,
    );

    expect(
      screen.getByRole('heading', { name: 'Base técnica preparada' }),
    ).toBeInTheDocument();
    expect(screen.getByText('product')).toBeInTheDocument();
  });
});
