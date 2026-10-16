import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HelmetProvider } from 'react-helmet-async';
import { DEFAULT_THEME, createSection } from '@ngo/shared';
import { applyTheme, SiteProvider } from '@/app/SiteProvider';
import { Markdown } from '@/components/site/Markdown';
import { SectionList } from '@/features/sections/SectionRenderer';
import { srcSet, sized } from '@/lib/image';

function wrap(ui: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <HelmetProvider>
      <QueryClientProvider client={qc}>
        <SiteProvider>
          <MemoryRouter>{ui}</MemoryRouter>
        </SiteProvider>
      </QueryClientProvider>
    </HelmetProvider>
  );
}

beforeAll(() => {
  window.matchMedia = window.matchMedia ?? ((q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false }));
  global.fetch = vi.fn(async () => new Response(JSON.stringify({ error: { message: 'offline' } }), { status: 503 })) as typeof fetch;
  global.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} takeRecords() { return []; } root = null; rootMargin = ''; thresholds = []; } as unknown as typeof IntersectionObserver;
});

describe('theme engine', () => {
  it('applies the published theme as CSS variables and style hooks', () => {
    const theme = { ...DEFAULT_THEME, colors: { ...DEFAULT_THEME.colors, primary: '#112233' }, shape: { ...DEFAULT_THEME.shape, buttonStyle: 'outline' as const } };
    applyTheme(theme, 'dark');
    const root = document.documentElement;
    expect(root.style.getPropertyValue('--c-primary')).toBe('17 34 51');
    expect(root.style.getPropertyValue('--c-bg')).toBe('16 22 19');
    expect(root.classList.contains('dark')).toBe(true);
    expect(root.dataset.btnStyle).toBe('outline');
    expect(document.getElementById('theme-fonts')?.getAttribute('href')).toContain('Fraunces');
  });
});

describe('markdown', () => {
  it('does not render raw HTML or javascript: links from CMS content', () => {
    const { container } = render(wrap(<Markdown>{'Hello <script>alert(1)</script> [x](javascript:alert(1)) <img src=x onerror=alert(1)>'}</Markdown>));
    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('img[onerror]')).toBeNull();
    expect(container.querySelector('a')?.getAttribute('href') ?? '').not.toContain('javascript');
  });
});

describe('section renderer', () => {
  it('renders visible sections in order and skips hidden ones', () => {
    const a = createSection('richText', { heading: 'First block', body: 'Alpha' });
    const b = { ...createSection('richText', { heading: 'Hidden block', body: 'Beta' }), visible: false };
    const c = createSection('richText', { heading: 'Second block', body: 'Gamma' });
    render(wrap(<SectionList sections={[a, b, c]} />));
    const headings = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(headings).toEqual(['First block', 'Second block']);
    expect(screen.queryByText('Hidden block')).toBeNull();
  });
});

describe('responsive images', () => {
  it('builds srcset for Unsplash and uploaded variants', () => {
    const u = 'https://images.unsplash.com/photo-1?auto=format&fit=crop&w=1600&q=80';
    expect(sized(u, 480)).toContain('w=480');
    expect(srcSet(u)?.split(',').length).toBe(5);
    expect(srcSet('/uploads/a.webp', { '480': '/uploads/a-480.webp' })).toBe('/uploads/a-480.webp 480w');
    expect(srcSet('/uploads/a.webp')).toBeUndefined();
  });
});
