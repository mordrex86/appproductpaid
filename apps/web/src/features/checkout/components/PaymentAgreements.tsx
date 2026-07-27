import type { PaymentConfiguration } from '../api';

export function PaymentAgreements({
  configuration,
  acceptedTerms,
  acceptedPersonalData,
  onTermsChange,
  onPersonalDataChange,
}: {
  readonly configuration: PaymentConfiguration | undefined;
  readonly acceptedTerms: boolean;
  readonly acceptedPersonalData: boolean;
  readonly onTermsChange: (accepted: boolean) => void;
  readonly onPersonalDataChange: (accepted: boolean) => void;
}) {
  return (
    <fieldset className="agreements">
      <legend>Autorizaciones</legend>
      <label>
        <input
          type="checkbox"
          checked={acceptedTerms}
          onChange={(event) => onTermsChange(event.target.checked)}
        />
        <span>
          Acepto los{' '}
          <a
            href={configuration?.terms.permalink}
            target="_blank"
            rel="noreferrer"
          >
            términos del servicio
          </a>
          .
        </span>
      </label>
      <label>
        <input
          type="checkbox"
          checked={acceptedPersonalData}
          onChange={(event) => onPersonalDataChange(event.target.checked)}
        />
        <span>
          Autorizo el{' '}
          <a
            href={configuration?.personalData.permalink}
            target="_blank"
            rel="noreferrer"
          >
            tratamiento de mis datos personales
          </a>
          .
        </span>
      </label>
    </fieldset>
  );
}
