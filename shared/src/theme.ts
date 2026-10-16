import { z } from 'zod';
import { colorSchema } from './common.js';

export const FONT_CHOICES = [
  'Fraunces',
  'Playfair Display',
  'Cormorant Garamond',
  'Libre Baskerville',
  'DM Serif Display',
  'Lora',
  'Inter',
  'Manrope',
  'DM Sans',
  'Plus Jakarta Sans',
  'Work Sans',
  'Source Sans 3',
  'Nunito Sans',
] as const;

export const themeSchema = z.object({
  colors: z.object({
    primary: colorSchema, // brand colour: buttons, links, accents
    primaryContrast: colorSchema, // text on primary
    secondary: colorSchema, // dark surfaces (footer, hero overlays)
    accent: colorSchema, // highlights, progress bars, eyebrow text
    background: colorSchema,
    surface: colorSchema, // cards
    surfaceAlt: colorSchema, // alternating section background
    text: colorSchema,
    muted: colorSchema,
    border: colorSchema,
  }),
  dark: z.object({
    background: colorSchema,
    surface: colorSchema,
    surfaceAlt: colorSchema,
    text: colorSchema,
    muted: colorSchema,
    border: colorSchema,
  }),
  typography: z.object({
    headingFont: z.enum(FONT_CHOICES),
    bodyFont: z.enum(FONT_CHOICES),
    baseSize: z.number().int().min(14).max(20),
    scale: z.number().min(1.1).max(1.5), // modular type scale ratio
    headingWeight: z.enum(['400', '500', '600', '700']),
    headingTracking: z.enum(['tight', 'normal']),
  }),
  shape: z.object({
    radius: z.number().int().min(0).max(32), // px for cards & images
    buttonShape: z.enum(['pill', 'rounded', 'square']),
    buttonStyle: z.enum(['solid', 'outline', 'soft']),
    cardStyle: z.enum(['elevated', 'bordered', 'flat']),
  }),
  layout: z.object({
    sectionSpacing: z.enum(['compact', 'comfortable', 'spacious']),
    containerWidth: z.enum(['narrow', 'standard', 'wide']),
    headerStyle: z.enum(['transparent', 'solid']),
    footerStyle: z.enum(['dark', 'light']),
  }),
  motion: z.object({
    enabled: z.boolean(),
    intensity: z.enum(['subtle', 'standard']),
  }),
  colorMode: z.enum(['light', 'dark', 'user']), // 'user' shows a toggle and follows system preference
});
export type Theme = z.infer<typeof themeSchema>;

export const DEFAULT_THEME: Theme = {
  colors: {
    primary: '#164B3A',
    primaryContrast: '#FFFFFF',
    secondary: '#0F2E24',
    accent: '#C6A76B',
    background: '#F8F5ED',
    surface: '#FFFFFF',
    surfaceAlt: '#EFEADC',
    text: '#252A27',
    muted: '#5C635E',
    border: '#E2DCCB',
  },
  dark: {
    background: '#101613',
    surface: '#18211D',
    surfaceAlt: '#141C18',
    text: '#EEF0EC',
    muted: '#A3ABA5',
    border: '#2A3530',
  },
  typography: {
    headingFont: 'Fraunces',
    bodyFont: 'Manrope',
    baseSize: 17,
    scale: 1.25,
    headingWeight: '500',
    headingTracking: 'tight',
  },
  shape: { radius: 18, buttonShape: 'pill', buttonStyle: 'solid', cardStyle: 'elevated' },
  layout: { sectionSpacing: 'comfortable', containerWidth: 'standard', headerStyle: 'transparent', footerStyle: 'dark' },
  motion: { enabled: true, intensity: 'subtle' },
  colorMode: 'user',
};

export const THEME_PRESETS: { key: string; name: string; description: string; theme: Theme }[] = [
  { key: 'forest', name: 'Forest & Gold', description: 'Default. Deep forest green, warm cream and muted gold.', theme: DEFAULT_THEME },
  {
    key: 'ocean',
    name: 'Ocean Trust',
    description: 'Calm navy and teal with a crisp white base.',
    theme: {
      ...DEFAULT_THEME,
      colors: {
        primary: '#14506B',
        primaryContrast: '#FFFFFF',
        secondary: '#0B2A3A',
        accent: '#E0A458',
        background: '#F6F8F9',
        surface: '#FFFFFF',
        surfaceAlt: '#E8EFF2',
        text: '#1D2A30',
        muted: '#57666D',
        border: '#D6E0E4',
      },
      typography: { ...DEFAULT_THEME.typography, headingFont: 'Playfair Display', bodyFont: 'Inter' },
    },
  },
  {
    key: 'terracotta',
    name: 'Terracotta Earth',
    description: 'Warm clay and sand tones for a grounded, community feel.',
    theme: {
      ...DEFAULT_THEME,
      colors: {
        primary: '#9C4A2F',
        primaryContrast: '#FFFFFF',
        secondary: '#3A2219',
        accent: '#D9A441',
        background: '#FBF6F0',
        surface: '#FFFFFF',
        surfaceAlt: '#F1E6DA',
        text: '#2B2420',
        muted: '#6B5E57',
        border: '#E8D9CA',
      },
      typography: { ...DEFAULT_THEME.typography, headingFont: 'DM Serif Display', headingWeight: '400', bodyFont: 'DM Sans' },
      shape: { ...DEFAULT_THEME.shape, radius: 10, buttonShape: 'rounded' },
    },
  },
  {
    key: 'minimal',
    name: 'Modern Minimal',
    description: 'Monochrome with a single green accent; sharp corners and bordered cards.',
    theme: {
      ...DEFAULT_THEME,
      colors: {
        primary: '#1F1F1F',
        primaryContrast: '#FFFFFF',
        secondary: '#111111',
        accent: '#2F8F5B',
        background: '#FFFFFF',
        surface: '#FFFFFF',
        surfaceAlt: '#F4F4F2',
        text: '#1A1A1A',
        muted: '#5E5E5E',
        border: '#E4E4E0',
      },
      typography: { ...DEFAULT_THEME.typography, headingFont: 'Plus Jakarta Sans', bodyFont: 'Plus Jakarta Sans', headingWeight: '700' },
      shape: { radius: 4, buttonShape: 'square', buttonStyle: 'solid', cardStyle: 'bordered' },
    },
  },
];

function hexToRgbChannels(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
}

const SPACING = { compact: '4rem', comfortable: '6rem', spacious: '8rem' } as const;
const CONTAINER = { narrow: '1080px', standard: '1240px', wide: '1440px' } as const;
const BUTTON_RADIUS = { pill: '999px', rounded: '10px', square: '2px' } as const;

/**
 * Converts a theme into CSS custom properties. Colours are emitted as RGB channels so Tailwind can apply
 * opacity modifiers (`bg-primary/80`). `mode` selects the light or dark surface palette.
 */
export function themeToCssVars(theme: Theme, mode: 'light' | 'dark' = 'light'): Record<string, string> {
  const c = theme.colors;
  const surfaces = mode === 'dark' ? { ...c, ...theme.dark } : c;
  const vars: Record<string, string> = {
    '--c-primary': hexToRgbChannels(c.primary),
    '--c-primary-contrast': hexToRgbChannels(c.primaryContrast),
    '--c-secondary': hexToRgbChannels(c.secondary),
    '--c-accent': hexToRgbChannels(c.accent),
    '--c-bg': hexToRgbChannels(surfaces.background),
    '--c-surface': hexToRgbChannels(surfaces.surface),
    '--c-surface-alt': hexToRgbChannels(surfaces.surfaceAlt),
    '--c-text': hexToRgbChannels(surfaces.text),
    '--c-muted': hexToRgbChannels(surfaces.muted),
    '--c-border': hexToRgbChannels(surfaces.border),
    '--font-heading': `"${theme.typography.headingFont}", Georgia, serif`,
    '--font-body': `"${theme.typography.bodyFont}", system-ui, sans-serif`,
    '--font-base': `${theme.typography.baseSize}px`,
    '--heading-weight': theme.typography.headingWeight,
    '--heading-tracking': theme.typography.headingTracking === 'tight' ? '-0.02em' : '0',
    '--radius': `${theme.shape.radius}px`,
    '--radius-btn': BUTTON_RADIUS[theme.shape.buttonShape],
    '--section-y': SPACING[theme.layout.sectionSpacing],
    '--container': CONTAINER[theme.layout.containerWidth],
  };
  // Modular type scale: h6 … h1 = base × ratio^n
  const r = theme.typography.scale;
  [1, 2, 3, 4, 5, 6].forEach((step) => {
    vars[`--fs-${step}`] = `${Math.pow(r, step).toFixed(3)}rem`;
  });
  return vars;
}

/** Fonts that need loading from Google Fonts for a theme. */
export function themeFonts(theme: Theme): string[] {
  return Array.from(new Set([theme.typography.headingFont, theme.typography.bodyFont]));
}

export function googleFontsHref(theme: Theme): string {
  const families = themeFonts(theme)
    .map((f) => `family=${f.replace(/ /g, '+')}:wght@400;500;600;700`)
    .join('&');
  return `https://fonts.googleapis.com/css2?${families}&display=swap`;
}
