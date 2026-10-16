import { Link, useParams } from 'react-router-dom';
import { ChevronLeft, Tag } from 'lucide-react';
import { useSite } from '@/app/SiteProvider';
import { date } from '@/lib/format';
import { usePublic } from '@/lib/queries';
import type { Post } from '@/lib/types';
import { PostCard } from '@/components/site/cards';
import { Markdown } from '@/components/site/Markdown';
import { Reveal } from '@/components/site/motion';
import { SampleBadge } from '@/components/site/SampleBadge';
import { Seo } from '@/components/site/Seo';
import { ShareButtons } from '@/components/site/ShareButtons';
import { SmartImage } from '@/components/site/SmartImage';
import { ArticleSkeleton, QueryGate, pageUrl } from './page-kit';

type PostDetail = Post & { body: string; related: Post[]; updatedAt?: string };

export default function PostDetailPage() {
  const { slug = '' } = useParams();
  const query = usePublic<PostDetail>(`/public/posts/${slug}`);
  return (
    <QueryGate query={query} skeleton={<ArticleSkeleton />}>
      {(p) => <PostView p={p} />}
    </QueryGate>
  );
}

function readingTime(text: string) {
  return Math.max(1, Math.round(text.split(/\s+/).filter(Boolean).length / 220));
}

function PostView({ p }: { p: PostDetail }) {
  const { settings } = useSite();
  const description = p.seoDescription || p.excerpt;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: p.title,
    description,
    image: p.coverImage || undefined,
    datePublished: p.publishedAt,
    dateModified: p.updatedAt ?? p.publishedAt,
    author: p.authorName ? { '@type': 'Person', name: p.authorName } : { '@type': 'Organization', name: settings.organization.name },
    publisher: { '@type': 'Organization', name: settings.organization.name, logo: settings.organization.logo ? { '@type': 'ImageObject', url: settings.organization.logo } : undefined },
    keywords: p.tags.join(', ') || undefined,
    mainEntityOfPage: pageUrl(),
  };
  return (
    <>
      <Seo title={p.seoTitle || p.title} description={description} image={p.coverImage} type="article" jsonLd={jsonLd} />
      <article>
        <header className="container-x pt-12 sm:pt-16">
          <div className="mx-auto max-w-3xl">
            <Link to="/blog" className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-muted transition hover:text-primary">
              <ChevronLeft className="h-4 w-4" aria-hidden /> All articles
            </Link>
            <Reveal>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                {p.category ? (
                  <Link to={`/blog?category=${p.category.slug}`} className="eyebrow hover:underline">{p.category.name}</Link>
                ) : (
                  <span className="eyebrow">News</span>
                )}
                <SampleBadge show={p.isSample} />
              </div>
              <h1 className="h-display mt-5 break-words">{p.title}</h1>
              {p.excerpt && <p className="lead mt-6">{p.excerpt}</p>}
              <p className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-muted">
                {p.authorName && <span className="font-medium text-ink">{p.authorName}</span>}
                {p.authorName && <span aria-hidden>·</span>}
                <time dateTime={p.publishedAt}>{date(p.publishedAt, 'long')}</time>
                <span aria-hidden>·</span>
                <span>{readingTime(p.body)} min read</span>
              </p>
            </Reveal>
          </div>
        </header>
        {p.coverImage && (
          <Reveal className="container-x mt-12">
            <div className="mx-auto max-w-5xl overflow-hidden rounded-theme-img">
              <div className="aspect-[16/9]">
                <SmartImage src={p.coverImage} alt={p.coverAlt || p.title} priority sizes="(min-width:1280px) 1100px, 100vw" width={2000} />
              </div>
            </div>
          </Reveal>
        )}
        <div className="container-x section-y">
          <div className="mx-auto max-w-3xl">
            <Markdown>{p.body}</Markdown>
            {p.tags.length > 0 && (
              <div className="mt-12 flex flex-wrap items-center gap-2">
                <Tag className="h-4 w-4 text-ink-muted" aria-hidden />
                <span className="sr-only">Tags:</span>
                {p.tags.map((t) => (
                  <Link key={t} to={`/blog?tag=${encodeURIComponent(t)}`} className="chip transition hover:border-primary hover:text-primary">{t}</Link>
                ))}
              </div>
            )}
            <div className="mt-8 border-t border-line pt-8"><ShareButtons title={p.title} /></div>
          </div>
        </div>
      </article>
      {p.related.length > 0 && (
        <section className="bg-surface-alt/50" aria-labelledby="related-heading">
          <div className="container-x section-y">
            <h2 id="related-heading" className="h-section mb-12">Keep reading</h2>
            <div className="grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
              {p.related.map((r, i) => <Reveal key={r.id} delay={i * 0.08}><PostCard p={r} /></Reveal>)}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
