/** All money is stored and computed in integer minor units (paise for INR). */
export const MINOR_UNITS: Record<string, number> = { INR: 100, USD: 100, EUR: 100, GBP: 100 };

export function toMinor(major: number, currency = 'INR'): number {
  return Math.round(major * (MINOR_UNITS[currency] ?? 100));
}

export function toMajor(minor: number, currency = 'INR'): number {
  return minor / (MINOR_UNITS[currency] ?? 100);
}

export function formatMoney(minor: number, currency = 'INR', locale = 'en-IN', compact = false): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    maximumFractionDigits: compact ? 1 : toMajor(minor, currency) % 1 === 0 ? 0 : 2,
    notation: compact ? 'compact' : 'standard',
  }).format(toMajor(minor, currency));
}

export function percent(part: number, whole: number): number {
  if (!whole || whole <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((part / whole) * 100)));
}
