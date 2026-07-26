describe('checkout persistence', () => {
  beforeEach(() => {
    sessionStorage.clear();
    jest.resetModules();
  });

  it('starts safely when storage is empty or invalid', async () => {
    const { loadCheckoutState } = await import('./store');
    expect(loadCheckoutState().step).toBe('product');

    sessionStorage.setItem('checkout-progress-v1', '{invalid');
    expect(loadCheckoutState().step).toBe('product');

    sessionStorage.setItem(
      'checkout-progress-v1',
      JSON.stringify({ step: 'unknown' }),
    );
    expect(loadCheckoutState().step).toBe('product');
  });

  it('restores only non-sensitive progress', async () => {
    sessionStorage.setItem(
      'checkout-progress-v1',
      JSON.stringify({
        step: 'summary',
        quantity: 2,
        card: { brand: 'visa', lastFour: '4242' },
      }),
    );
    const { loadCheckoutState } = await import('./store');

    expect(loadCheckoutState()).toMatchObject({
      step: 'summary',
      quantity: 2,
      card: { brand: 'visa', lastFour: '4242' },
      productStatus: 'idle',
      transactionStatus: 'idle',
    });
  });
});
