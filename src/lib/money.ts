export const CURRENCY = "NGN";

export function formatMoney(cents: number): string {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: CURRENCY,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}
