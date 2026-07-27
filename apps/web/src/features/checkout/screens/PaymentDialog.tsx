import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useAppDispatch } from '../../../app/hooks';
import { getPaymentConfiguration, tokenizeCard } from '../api';
import type { PaymentConfiguration } from '../api';
import {
  cardDigits,
  detectCardBrand,
  toColombianPhone,
  validateCheckoutForm,
} from '../validation';
import type { CheckoutFormValues, FormErrors } from '../validation';
import { checkoutDetailsSaved } from '../model/checkoutSlice';
import type { CheckoutState } from '../model/checkoutSlice';
import { CardFields } from '../components/CardFields';
import { DeliveryFields } from '../components/DeliveryFields';
import { PaymentAgreements } from '../components/PaymentAgreements';

function initialValues(checkout: CheckoutState): CheckoutFormValues {
  return {
    cardNumber: '',
    cardholder: '',
    expiry: '',
    cvc: '',
    fullName: checkout.customer?.fullName ?? '',
    email: checkout.customer?.email ?? '',
    phone: checkout.customer?.phone.replace(/^\+57/, '') ?? '',
    addressLine: checkout.delivery?.addressLine ?? '',
    city: checkout.delivery?.city ?? '',
    region: checkout.delivery?.region ?? '',
    postalCode: checkout.delivery?.postalCode ?? '',
  };
}

export function PaymentDialog({
  checkout,
  onBack,
}: {
  readonly checkout: CheckoutState;
  readonly onBack: () => void;
}) {
  const dispatch = useAppDispatch();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [values, setValues] = useState(() => initialValues(checkout));
  const [errors, setErrors] = useState<FormErrors>({});
  const [configuration, setConfiguration] = useState<PaymentConfiguration>();
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedPersonalData, setAcceptedPersonalData] = useState(false);
  const [paymentError, setPaymentError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog !== null && !dialog.open) dialog.showModal();
    return () => {
      if (dialog?.open === true) dialog.close();
    };
  }, []);

  useEffect(() => {
    void getPaymentConfiguration()
      .then(setConfiguration)
      .catch((error: unknown) =>
        setPaymentError(
          error instanceof Error
            ? error.message
            : 'No fue posible preparar el pago.',
        ),
      );
  }, []);

  const update = (field: keyof CheckoutFormValues, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => {
      const next = { ...current };
      delete next[field];
      return next;
    });
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors = validateCheckoutForm(values);
    const brand = detectCardBrand(values.cardNumber);
    if (Object.keys(nextErrors).length > 0 || brand === undefined) {
      setErrors(nextErrors);
      return;
    }
    if (
      configuration === undefined ||
      !acceptedTerms ||
      !acceptedPersonalData
    ) {
      setPaymentError(
        'Debes aceptar los términos y el uso de datos para continuar.',
      );
      return;
    }

    setSubmitting(true);
    setPaymentError(undefined);
    try {
      const paymentToken = await tokenizeCard(configuration, {
        number: values.cardNumber,
        cardholder: values.cardholder,
        expiry: values.expiry,
        cvc: values.cvc,
      });
      dispatch(
        checkoutDetailsSaved({
          customer: {
            fullName: values.fullName.trim(),
            email: values.email.trim(),
            phone: toColombianPhone(values.phone),
          },
          delivery: {
            addressLine: values.addressLine.trim(),
            city: values.city.trim(),
            region: values.region.trim(),
            postalCode: values.postalCode.trim(),
          },
          card: {
            brand,
            lastFour: cardDigits(values.cardNumber).slice(-4),
          },
          paymentAuthorization: {
            paymentToken,
            acceptanceToken: configuration.terms.acceptanceToken,
            personalDataToken: configuration.personalData.acceptanceToken,
          },
          idempotencyKey: crypto.randomUUID(),
        }),
      );
    } catch (error) {
      setPaymentError(
        error instanceof Error
          ? error.message
          : 'No fue posible validar la tarjeta.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <dialog
      className="checkout-dialog"
      ref={dialogRef}
      aria-labelledby="checkout-dialog-title"
      onCancel={(event) => {
        event.preventDefault();
        onBack();
      }}
    >
      <form method="dialog" onSubmit={submit} noValidate>
        <div className="dialog-heading">
          <div>
            <p>Datos de pago y entrega</p>
            <h2 id="checkout-dialog-title">Completa tu compra</h2>
          </div>
          <button className="text-button" type="button" onClick={onBack}>
            Volver
          </button>
        </div>

        <CardFields values={values} errors={errors} update={update} />
        <DeliveryFields values={values} errors={errors} update={update} />
        <PaymentAgreements
          configuration={configuration}
          acceptedTerms={acceptedTerms}
          acceptedPersonalData={acceptedPersonalData}
          onTermsChange={setAcceptedTerms}
          onPersonalDataChange={setAcceptedPersonalData}
        />

        <div className="dialog-actions">
          <div>
            <p>La tarjeta y el CVC no se guardan en este dispositivo.</p>
            {paymentError !== undefined && (
              <p className="request-error" role="alert">
                {paymentError}
              </p>
            )}
          </div>
          <button
            className="primary-button"
            type="submit"
            disabled={submitting || configuration === undefined}
          >
            {submitting ? 'Validando tarjeta...' : 'Revisar compra'}
          </button>
        </div>
      </form>
    </dialog>
  );
}
