import type { CheckoutFormValues, FormErrors } from '../validation';
import { FieldError } from './FieldError';

type UpdateField = (field: keyof CheckoutFormValues, value: string) => void;

export function DeliveryFields({
  values,
  errors,
  update,
}: {
  readonly values: CheckoutFormValues;
  readonly errors: FormErrors;
  readonly update: UpdateField;
}) {
  return (
    <fieldset>
      <legend>Entrega</legend>

      <div className="field full-field">
        <label htmlFor="fullName">Nombre de quien recibe</label>
        <input
          id="fullName"
          name="fullName"
          autoComplete="name"
          value={values.fullName}
          aria-invalid={errors.fullName !== undefined}
          aria-describedby={
            errors.fullName === undefined ? undefined : 'fullName-error'
          }
          onChange={(event) => update('fullName', event.target.value)}
        />
        <FieldError id="fullName-error" message={errors.fullName} />
      </div>

      <div className="field">
        <label htmlFor="email">Correo</label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          value={values.email}
          aria-invalid={errors.email !== undefined}
          aria-describedby={
            errors.email === undefined ? undefined : 'email-error'
          }
          onChange={(event) => update('email', event.target.value)}
        />
        <FieldError id="email-error" message={errors.email} />
      </div>

      <div className="field">
        <label htmlFor="phone">Teléfono</label>
        <input
          id="phone"
          name="phone"
          type="tel"
          autoComplete="tel"
          placeholder="3001234567"
          maxLength={10}
          value={values.phone}
          aria-invalid={errors.phone !== undefined}
          aria-describedby={
            errors.phone === undefined ? undefined : 'phone-error'
          }
          onChange={(event) =>
            update('phone', event.target.value.replace(/\D/g, '').slice(0, 10))
          }
        />
        <FieldError id="phone-error" message={errors.phone} />
      </div>

      <div className="field full-field">
        <label htmlFor="addressLine">Dirección</label>
        <input
          id="addressLine"
          name="addressLine"
          autoComplete="street-address"
          value={values.addressLine}
          aria-invalid={errors.addressLine !== undefined}
          aria-describedby={
            errors.addressLine === undefined ? undefined : 'addressLine-error'
          }
          onChange={(event) => update('addressLine', event.target.value)}
        />
        <FieldError id="addressLine-error" message={errors.addressLine} />
      </div>

      <div className="field">
        <label htmlFor="city">Ciudad</label>
        <input
          id="city"
          name="city"
          autoComplete="address-level2"
          value={values.city}
          aria-invalid={errors.city !== undefined}
          aria-describedby={
            errors.city === undefined ? undefined : 'city-error'
          }
          onChange={(event) => update('city', event.target.value)}
        />
        <FieldError id="city-error" message={errors.city} />
      </div>

      <div className="field">
        <label htmlFor="region">Departamento</label>
        <input
          id="region"
          name="region"
          autoComplete="address-level1"
          value={values.region}
          aria-invalid={errors.region !== undefined}
          aria-describedby={
            errors.region === undefined ? undefined : 'region-error'
          }
          onChange={(event) => update('region', event.target.value)}
        />
        <FieldError id="region-error" message={errors.region} />
      </div>

      <div className="field">
        <label htmlFor="postalCode">Código postal</label>
        <input
          id="postalCode"
          name="postalCode"
          autoComplete="postal-code"
          value={values.postalCode}
          aria-invalid={errors.postalCode !== undefined}
          aria-describedby={
            errors.postalCode === undefined ? undefined : 'postalCode-error'
          }
          onChange={(event) => update('postalCode', event.target.value)}
        />
        <FieldError id="postalCode-error" message={errors.postalCode} />
      </div>
    </fieldset>
  );
}
