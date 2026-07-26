import {
  cardDigits,
  detectCardBrand,
  formatCardNumber,
  isValidCardNumber,
  isValidExpiry,
  validateCheckoutForm,
} from './validation';

const validForm = {
  cardNumber: '4242 4242 4242 4242',
  cardholder: 'Laura Medina',
  expiry: '12/99',
  cvc: '123',
  fullName: 'Laura Medina',
  email: 'laura@example.com',
  phone: '+573001234567',
  addressLine: 'Calle 10 # 20-30',
  city: 'Bogotá',
  region: 'Cundinamarca',
  postalCode: '110111',
};

describe('checkout validation', () => {
  it('formats card input and detects supported brands', () => {
    expect(cardDigits('4242-4242x')).toBe('42424242');
    expect(formatCardNumber('4242424242424242')).toBe('4242 4242 4242 4242');
    expect(detectCardBrand('4242')).toBe('visa');
    expect(detectCardBrand('5555')).toBe('mastercard');
    expect(detectCardBrand('2221')).toBe('mastercard');
    expect(detectCardBrand('3000')).toBeUndefined();
  });

  it('validates Luhn and expiration rules', () => {
    expect(isValidCardNumber('4242 4242 4242 4242')).toBe(true);
    expect(isValidCardNumber('4242 4242 4242 4241')).toBe(false);
    expect(isValidCardNumber('3000')).toBe(false);
    expect(isValidExpiry('12/26', new Date(2026, 6, 1))).toBe(true);
    expect(isValidExpiry('06/26', new Date(2026, 6, 1))).toBe(false);
    expect(isValidExpiry('13/29')).toBe(false);
    expect(isValidExpiry('invalid')).toBe(false);
  });

  it('accepts complete data and reports every invalid field', () => {
    expect(validateCheckoutForm(validForm)).toEqual({});

    expect(
      validateCheckoutForm({
        cardNumber: '',
        cardholder: '',
        expiry: '',
        cvc: '',
        fullName: '',
        email: 'invalid',
        phone: '1',
        addressLine: '',
        city: '',
        region: '',
        postalCode: '?',
      }),
    ).toEqual({
      cardNumber: expect.any(String),
      cardholder: expect.any(String),
      expiry: expect.any(String),
      cvc: expect.any(String),
      fullName: expect.any(String),
      email: expect.any(String),
      phone: expect.any(String),
      addressLine: expect.any(String),
      city: expect.any(String),
      region: expect.any(String),
      postalCode: expect.any(String),
    });
  });
});
