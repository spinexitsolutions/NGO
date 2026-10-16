import { Helmet } from 'react-helmet-async';
import { useLocation } from 'react-router-dom';
import { useSite } from '@/app/SiteProvider';
import { sized } from '@/lib/image';

interface Props {
  title?: string;
  description?: string;
  image?: string;
  noIndex?: boolean;
  type?: 'website' | 'article';
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
}

/** Title, meta description, canonical URL, Open Graph/Twitter cards and JSON-LD structured data. */
export function Seo({ title, description, image, noIndex, type = 'website', jsonLd }: Props) {
  const { settings } = useSite();
  const { pathname } = useLocation();
  const site = settings.organization.name;
  const full = title ? settings.seo.titleTemplate.replace('%s', title).replace('{site}', site) : `${site} — ${settings.organization.tagline}`;
  const desc = description || settings.seo.defaultDescription || settings.organization.description;
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const canonical = `${origin}${pathname === '/' ? '/' : pathname.replace(/\/$/, '')}`;
  const img = image || settings.seo.ogImage;
  const ogImage = img ? (img.startsWith('http') ? sized(img, 1200) : `${origin}${img}`) : undefined;
  return (
    <Helmet>
      <title>{full}</title>
      <meta name="description" content={desc} />
      <link rel="canonical" href={canonical} />
      {noIndex && <meta name="robots" content="noindex" />}
      <meta property="og:site_name" content={site} />
      <meta property="og:type" content={type} />
      <meta property="og:title" content={title ?? site} />
      <meta property="og:description" content={desc} />
      <meta property="og:url" content={canonical} />
      {ogImage && <meta property="og:image" content={ogImage} />}
      <meta name="twitter:card" content={ogImage ? 'summary_large_image' : 'summary'} />
      {settings.organization.favicon && <link rel="icon" href={settings.organization.favicon} />}
      {jsonLd && <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>}
    </Helmet>
  );
}
