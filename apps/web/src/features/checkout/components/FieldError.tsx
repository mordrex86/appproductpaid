export function FieldError({
  id,
  message,
}: {
  readonly id: string;
  readonly message: string | undefined;
}) {
  if (message === undefined) return null;

  return (
    <span className="field-error" id={id}>
      {message}
    </span>
  );
}
