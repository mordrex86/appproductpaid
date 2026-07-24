export type Result<TValue, TError> =
  | {
      readonly ok: true;
      readonly value: TValue;
    }
  | {
      readonly error: TError;
      readonly ok: false;
    };

export const success = <TValue>(value: TValue): Result<TValue, never> => ({
  ok: true,
  value,
});

export const failure = <TError>(error: TError): Result<never, TError> => ({
  error,
  ok: false,
});
