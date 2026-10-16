import type { Config } from 'tailwindcss';
import typography from '@tailwindcss/typography';

const v = (name: string) => `rgb(var(${name}) / <alpha-value>)`;

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: ['class'],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: v('--c-primary'), contrast: v('--c-primary-contrast') },
        secondary: v('--c-secondary'),
        accent: v('--c-accent'),
        bg: v('--c-bg'),
        surface: { DEFAULT: v('--c-surface'), alt: v('--c-surface-alt') },
        ink: { DEFAULT: v('--c-text'), muted: v('--c-muted') },
        line: v('--c-border'),
      },
      fontFamily: {
        heading: 'var(--font-heading)',
        body: 'var(--font-body)',
      },
      borderRadius: { theme: 'var(--radius)', btn: 'var(--radius-btn)' },
      maxWidth: { container: 'var(--container)' },
      spacing: { section: 'var(--section-y)' },
      fontSize: {
        'fs-1': ['var(--fs-1)', { lineHeight: '1.3' }],
        'fs-2': ['var(--fs-2)', { lineHeight: '1.25' }],
        'fs-3': ['var(--fs-3)', { lineHeight: '1.2' }],
        'fs-4': ['var(--fs-4)', { lineHeight: '1.12' }],
        'fs-5': ['var(--fs-5)', { lineHeight: '1.06' }],
        'fs-6': ['var(--fs-6)', { lineHeight: '1.02' }],
      },
      keyframes: {
        'kenburns': { '0%': { transform: 'scale(1.0)' }, '100%': { transform: 'scale(1.08)' } },
        'shimmer': { '100%': { transform: 'translateX(100%)' } },
      },
      animation: { kenburns: 'kenburns 14s ease-out forwards', shimmer: 'shimmer 1.6s infinite' },
    },
  },
  plugins: [typography],
} satisfies Config;
