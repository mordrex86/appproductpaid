import type { CheckoutFormValues, FormErrors } from '../validation';
import { detectCardBrand, formatCardNumber } from '../validation';
import { FieldError } from './FieldError';

type UpdateField = (field: keyof CheckoutFormValues, value: string) => void;

export function CardFields({
  values,
  errors,
  update,
}: {
  readonly values: CheckoutFormValues;
  readonly errors: FormErrors;
  readonly update: UpdateField;
}) {
  const brand = detectCardBrand(values.cardNumber);

  return (
    <fieldset>
      <legend>Tarjeta</legend>
      <p className="field-note">
        Usa únicamente datos de prueba del entorno Sandbox.
      </p>

      <div className="field full-field">
        <label htmlFor="cardNumber">Número de tarjeta</label>
        <div className="card-number-control">
          <input
            autoFocus
            id="cardNumber"
            name="cardNumber"
            inputMode="numeric"
            autoComplete="cc-number"
            placeholder="0000 0000 0000 0000"
            value={values.cardNumber}
            aria-invalid={errors.cardNumber !== undefined}
            aria-describedby={
              errors.cardNumber === undefined ? undefined : 'cardNumber-error'
            }
            onChange={(event) =>
              update('cardNumber', formatCardNumber(event.target.value))
            }
          />
          <span className={`card-brand ${brand ?? ''}`}>
            {brand === 'visa'
              ? 'VISA'
              : brand === 'mastercard'
                ? 'Mastercard'
                : 'Visa o Mastercard'}
          </span>
        </div>
        <FieldError id="cardNumber-error" message={errors.cardNumber} />
      </div>

      <div className="field full-field">
        <label htmlFor="cardholder">Nombre en la tarjeta</label>
        <input
          id="cardholder"
          name="cardholder"
          autoComplete="cc-name"
          value={values.cardholder}
          aria-invalid={errors.cardholder !== undefined}
          aria-describedby={
            errors.cardholder === undefined ? undefined : 'cardholder-error'
          }
          onChange={(event) => update('cardholder', event.target.value)}
        />
        <FieldError id="cardholder-error" message={errors.cardholder} />
      </div>

      <div className="field">
        <label htmlFor="expiry">Vencimiento</label>
        <input
          id="expiry"
          name="expiry"
          inputMode="numeric"
          autoComplete="cc-exp"
          placeholder="MM/AA"
          maxLength={5}
          value={values.expiry}
          aria-invalid={errors.expiry !== undefined}
          aria-describedby={
            errors.expiry === undefined ? undefined : 'expiry-error'
          }
          onChange={(event) => {
            const digits = event.target.value.replace(/\D/g, '').slice(0, 4);
            update(
              'expiry',
              digits.length > 2
                ? `${digits.slice(0, 2)}/${digits.slice(2)}`
                : digits,
            );
          }}
        />
        <FieldError id="expiry-error" message={errors.expiry} />
      </div>

      <div className="field">
        <label htmlFor="cvc">Código de seguridad</label>
        <input
          id="cvc"
          name="cvc"
          type="password"
          inputMode="numeric"
          autoComplete="cc-csc"
          maxLength={3}
          value={values.cvc}
          aria-invalid={errors.cvc !== undefined}
          aria-describedby={errors.cvc === undefined ? undefined : 'cvc-error'}
          onChange={(event) =>
            update('cvc', event.target.value.replace(/\D/g, '').slice(0, 3))
          }
        />
        <FieldError id="cvc-error" message={errors.cvc} />
      </div>
    </fieldset>
  );
}
