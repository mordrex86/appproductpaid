const currency = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
});

export function formatMoney(amountInCents: number): string {
  return currency.format(amountInCents / 100);
}
