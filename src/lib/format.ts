const compactFormatter = new Intl.NumberFormat("en-PH", { notation: "compact", maximumFractionDigits: 1 });
const currencyCompactFormatter = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  notation: "compact",
  maximumFractionDigits: 1,
});
const currencyFormatter = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  maximumFractionDigits: 0,
});

/** 1,284 / 12.9K / 4.2M — for stat tiles and hero figures. */
export function formatCompact(n: number): string {
  return compactFormatter.format(n);
}

/** ₱1,284 / ₱12.9K — for stat tiles. */
export function formatCurrencyCompact(n: number): string {
  return currencyCompactFormatter.format(n);
}

/** ₱1,284 — full precision, for tooltips and table views. */
export function formatCurrency(n: number): string {
  return currencyFormatter.format(n);
}
