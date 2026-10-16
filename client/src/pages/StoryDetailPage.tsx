import { Link, useParams } from 'react-router-dom';
import { ChevronLeft, Heart, MapPin } from 'lucide-react';
import { date } from '@/lib/format';
import { usePublic } from '@/lib/queries';
import type { Story } from '@/lib/types';
import { ButtonLink } from '@/components/ui';
import { Markdown } from '@/components/site/Markdown';
import { Reveal } from '@/components/site/motion';
import { SampleBadge } from '@/components/site/SampleBadge';
import { Seo } from '@/components/site/Seo';
import { ShareButtons } from '@/components/site/ShareButtons';
import { SmartImage } from '@/components/site/SmartImage';
import { ArticleSkeleton, QueryGate, pageUrl } from './page-kit';

export default function StoryDetailPage() {
  const { slug = '' } = useParams();
  const query = usePublic<Story>(`/public/c/stories/${slug}`);
  return (
    <QueryGate query={query} skeleton={<ArticleSkeleton />}>
      {(s) => <StoryView s={s} />}
    </QueryGate>
  );
}

function StoryView({ s }: { s: Story }) {
  const meta = [s.personName, s.location, s.publishedAt && date(s.publishedAt, 'long')].filter(Boolean);
  return (
    <article>
      <Seo
        title={s.seoTitle || s.title}
        description={s.seoDescription || s.excerpt}
        image={s.image}
        type="article"
        jsonLd={{ '@context': 'https://schema.org', '@type': 'Article', headline: s.title, description: s.excerpt, image: s.image || undefined, datePublished: s.publishedAt ?? undefined, url: pageUrl() }}
      />
      <header className="container-x pt-12 sm:pt-16">
        <div className="mx-auto max-w-3xl">
          <Link to="/stories" className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-muted transition hover:text-primary">
            <ChevronLeft className="h-4 w-4" aria-hidden /> All stories
          </Link>
          <Reveal>
            <p className="eyebrow mt-8">Story of change</p>
            <h1 className="h-display mt-5 break-words">{s.title}</h1>
            {s.excerpt && <p className="lead mt-6">{s.excerpt}</p>}
            <div className="mt-6 flex flex-wrap items-center gap-3 text-sm text-ink-muted">
              {meta.map((m, i) => (
                <span key={i} className="inline-flex items-center gap-1.5">
                  {i > 0 && <span aria-hidden>·</span>}
                  {m === s.location && <MapPin className="h-3.5 w-3.5" aria-hidden />}
                  {m}
                </span>
              ))}
              <SampleBadge show={s.isSample} />
            </div>
          </Reveal>
        </div>
      </header>
      {s.image && (
        <Reveal className="container-x mt-12">
          <figure className="mx-auto max-w-5xl overflow-hidden rounded-theme-img">
            <div className="aspect-[16/9]">
              <SmartImage src={s.image} alt={s.imageAlt || s.title} priority sizes="(min-width:1280px) 1100px, 100vw" width={2000} />
            </div>
          </figure>
        </Reveal>
      )}
      <div className="container-x section-y">
        <div className="mx-auto max-w-3xl">
          <Markdown>{s.body}</Markdown>
          <div className="mt-12 border-t border-line pt-8"><ShareButtons title={s.title} /></div>
          <div className="mt-12 rounded-theme-img bg-surface-alt p-8 text-center sm:p-10">
            <p className="font-heading text-2xl sm:text-fs-2">Help write the next story like this.</p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <ButtonLink href="/donate" icon={Heart}>Donate</ButtonLink>
              <ButtonLink href="/stories" variant="outline">More stories</ButtonLink>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}
