import { formatMoney } from '@ngo/shared';

export const money = (minor: number | null | undefined, currency = 'INR', compact = false) => formatMoney(minor ?? 0, currency, currency === 'INR' ? 'en-IN' : 'en-US', compact);

export function date(value: string | Date | null | undefined, style: 'medium' | 'long' | 'short' = 'medium') {
  if (!value) return '';
  return new Date(value).toLocaleDateString('en-IN', { dateStyle: style });
}
export function dateTime(value: string | Date | null | undefined) {
  if (!value) return '';
  return new Date(value).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}
export function relative(value: string | Date) {
  const diff = (Date.now() - new Date(value).getTime()) / 1000;
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  if (Math.abs(diff) < 60) return 'just now';
  if (Math.abs(diff) < 3600) return rtf.format(-Math.round(diff / 60), 'minute');
  if (Math.abs(diff) < 86400) return rtf.format(-Math.round(diff / 3600), 'hour');
  if (Math.abs(diff) < 86400 * 30) return rtf.format(-Math.round(diff / 86400), 'day');
  return date(value);
}
export const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString('en-IN')} ${n === 1 ? one : many}`;
export const titleCase = (s: string) => s.toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
