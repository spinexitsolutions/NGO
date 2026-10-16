import { describe, expect, it } from 'vitest';
import {
  COLLECTIONS,
  DEFAULT_NAVIGATION,
  DEFAULT_SETTINGS,
  DEFAULT_THEME,
  SECTION_META,
  SECTION_TYPES,
  THEME_PRESETS,
  createSection,
  donationCheckoutSchema,
  fieldsToZod,
  formatMoney,
  linkSchema,
  navigationSchema,
  settingsSchema,
  slugify,
  themeSchema,
  themeToCssVars,
  validateSections,
} from '../src/index.js';

describe('theme', () => {
  it('default theme and all presets are valid', () => {
    expect(themeSchema.safeParse(DEFAULT_THEME).success).toBe(true);
    for (const p of THEME_PRESETS) expect(themeSchema.safeParse(p.theme).success, p.key).toBe(true);
  });
  it('converts colours to RGB channels and switches surfaces in dark mode', () => {
    const light = themeToCssVars(DEFAULT_THEME, 'light');
    expect(light['--c-primary']).toBe('22 75 58');
    expect(light['--c-bg']).toBe('248 245 237');
    const dark = themeToCssVars(DEFAULT_THEME, 'dark');
    expect(dark['--c-bg']).toBe('16 22 19');
    expect(dark['--c-primary']).toBe(light['--c-primary']);
  });
  it('rejects invalid colours', () => {
    const bad = { ...DEFAULT_THEME, colors: { ...DEFAULT_THEME.colors, primary: 'red' } };
    expect(themeSchema.safeParse(bad).success).toBe(false);
  });
});

describe('settings & navigation', () => {
  it('defaults are valid', () => {
    expect(settingsSchema.safeParse(DEFAULT_SETTINGS).success).toBe(true);
    expect(navigationSchema.safeParse(DEFAULT_NAVIGATION).success).toBe(true);
  });
  it('blocks javascript: links', () => {
    expect(linkSchema.safeParse('javascript:alert(1)').success).toBe(false);
    expect(linkSchema.safeParse('/donate').success).toBe(true);
    expect(linkSchema.safeParse('https://example.org').success).toBe(true);
  });
});

describe('sections', () => {
  it('every section type has defaults that build', () => {
    for (const t of SECTION_TYPES) {
      const s = createSection(t);
      expect(s.type).toBe(t);
      expect(SECTION_META[t].fields.length).toBeGreaterThan(0);
    }
  });
  it('publish validation reports missing required props', () => {
    const hero = createSection('hero');
    const { errors } = validateSections([hero]);
    expect(errors[0]?.issues.some((i) => i.path === 'heading')).toBe(true);
    const ok = validateSections([{ ...hero, props: { ...hero.props, heading: 'Hello' } }]);
    expect(ok.errors).toHaveLength(0);
  });
  it('rejects unsafe links inside repeater buttons', () => {
    const hero = createSection('hero', { heading: 'x', ctas: [{ label: 'Go', href: 'javascript:alert(1)', variant: 'primary' }] });
    expect(validateSections([hero]).errors).toHaveLength(1);
  });
});

describe('collections', () => {
  it('generates schemas for every collection', () => {
    for (const c of COLLECTIONS) expect(() => fieldsToZod(c.fields)).not.toThrow();
  });
  it('stories require consent before publishing', () => {
    const stories = COLLECTIONS.find((c) => c.key === 'stories')!;
    expect(stories.rules!({ status: 'PUBLISHED', consentObtained: false })).toHaveProperty('consentObtained');
    expect(stories.rules!({ status: 'PUBLISHED', consentObtained: true })).toEqual({});
  });
});

describe('forms & money', () => {
  it('donation checkout requires integer minor units and rejects honeypot', () => {
    const base = { amount: 50000, name: 'Asha', email: 'asha@example.org' };
    expect(donationCheckoutSchema.safeParse(base).success).toBe(true);
    expect(donationCheckoutSchema.safeParse({ ...base, amount: 10.5 }).success).toBe(false);
    expect(donationCheckoutSchema.safeParse({ ...base, website: 'spam' }).success).toBe(false);
  });
  it('formats money from minor units', () => {
    expect(formatMoney(150000, 'INR')).toBe('₹1,500');
    expect(slugify('Clean Water for Ramgarh!')).toBe('clean-water-for-ramgarh');
  });
});
