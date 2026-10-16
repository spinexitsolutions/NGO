import type { Section } from '@ngo/shared';

export interface SectionProps<P = Record<string, unknown>> {
  section: Section;
  props: P;
  isFirst: boolean;
}

export const str = (v: unknown, fallback = '') => (typeof v === 'string' ? v : fallback);
export const num = (v: unknown, fallback: number) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);
export const arr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
export type Cta = { label: string; href: string; variant: 'primary' | 'accent' | 'outline' | 'ghost' };
