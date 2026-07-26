import type { CardBrand } from './model/checkoutSlice';

export interface CheckoutFormValues {
  readonly cardNumber: string;
  readonly cardholder: string;
  readonly expiry: string;
  readonly cvc: string;
  readonly fullName: string;
  readonly email: string;
  readonly phone: string;
  readonly addressLine: string;
  readonly city: string;
  readonly region: string;
  readonly postalCode: string;
}

export type FormErrors = Partial<Record<keyof CheckoutFormValues, string>>;

export function cardDigits(value: string): string {
  return value.replace(/\D/g, '').slice(0, 16);
}

export function detectCardBrand(value: string): CardBrand | undefined {
  const digits = cardDigits(value);
  const prefix = Number(digits.slice(0, 4));

  if (digits.startsWith('4')) return 'visa';
  if (
    /^5[1-5]/.test(digits) ||
    (digits.length >= 4 && prefix >= 2221 && prefix <= 2720)
  ) {
    return 'mastercard';
  }
  return undefined;
}

export function formatCardNumber(value: string): string {
  return cardDigits(value).replace(/(\d{4})(?=\d)/g, '$1 ');
}

export function isValidCardNumber(value: string): boolean {
  const digits = cardDigits(value);
  if (digits.length !== 16 || detectCardBrand(digits) === undefined) {
    return false;
  }

  const sum = [...digits].reverse().reduce((total, digit, index) => {
    let number = Number(digit);
    if (index % 2 === 1) {
      number *= 2;
      if (number > 9) number -= 9;
    }
    return total + number;
  }, 0);

  return sum % 10 === 0;
}

export function isValidExpiry(value: string, today = new Date()): boolean {
  const match = /^(\d{2})\/(\d{2})$/.exec(value);
  if (match === null) return false;

  const month = Number(match[1]);
  const year = 2000 + Number(match[2]);
  if (month < 1 || month > 12) return false;

  return (
    year > today.getFullYear() ||
    (year === today.getFullYear() && month >= today.getMonth() + 1)
  );
}

export function validateCheckoutForm(values: CheckoutFormValues): FormErrors {
  const errors: FormErrors = {};

  if (!isValidCardNumber(values.cardNumber)) {
    errors.cardNumber = 'Ingresa una tarjeta Visa o Mastercard válida.';
  }
  if (values.cardholder.trim().length < 3) {
    errors.cardholder = 'Escribe el nombre como aparece en la tarjeta.';
  }
  if (!isValidExpiry(values.expiry)) {
    errors.expiry = 'Usa una fecha vigente en formato MM/AA.';
  }
  if (!/^\d{3}$/.test(values.cvc)) {
    errors.cvc = 'El código debe tener 3 dígitos.';
  }
  if (values.fullName.trim().length < 3) {
    errors.fullName = 'Escribe el nombre de quien recibe.';
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) {
    errors.email = 'Ingresa un correo válido.';
  }
  if (!/^\+?[1-9]\d{9,14}$/.test(values.phone.replace(/\s/g, ''))) {
    errors.phone = 'Ingresa el número con código de país.';
  }
  if (values.addressLine.trim().length < 5) {
    errors.addressLine = 'Completa la dirección de entrega.';
  }
  if (values.city.trim().length < 2) {
    errors.city = 'Escribe la ciudad.';
  }
  if (values.region.trim().length < 2) {
    errors.region = 'Escribe el departamento.';
  }
  if (!/^[A-Za-z0-9 -]{3,12}$/.test(values.postalCode.trim())) {
    errors.postalCode = 'Ingresa un código postal válido.';
  }

  return errors;
}
