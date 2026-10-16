/**
 * Responsive image helpers. Unsplash URLs are resized on their CDN (auto=format serves AVIF/WebP);
 * uploaded assets use the WebP variants generated on upload.
 */
const WIDTHS = [480, 768, 1080, 1600, 2200];

export function isUnsplash(url: string) {
  return url.startsWith('https://images.unsplash.com/');
}

export function sized(url: string, width: number): string {
  if (!isUnsplash(url)) return url;
  const u = new URL(url);
  u.searchParams.set('w', String(width));
  u.searchParams.set('auto', 'format');
  if (!u.searchParams.get('q')) u.searchParams.set('q', '78');
  return u.toString();
}

export function srcSet(url: string, variants?: Record<string, string>): string | undefined {
  if (isUnsplash(url)) return WIDTHS.map((w) => `${sized(url, w)} ${w}w`).join(', ');
  if (variants && Object.keys(variants).length) return Object.entries(variants).map(([w, u]) => `${u} ${w}w`).join(', ');
  return undefined;
}
