import { Link } from 'react-router-dom';
import { ArrowUpRight, CalendarDays, MapPin, Users } from 'lucide-react';
import { cn } from '@/lib/cn';
import { date, money } from '@/lib/format';
import type { Campaign, Cause, EventItem, Post, Project, Story } from '@/lib/types';
import { Badge } from '@/components/ui';
import { Icon } from './Icon';
import { ProgressBar } from './motion';
import { SampleBadge } from './SampleBadge';
import { SmartImage } from './SmartImage';

const SIZES = '(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw';

function CardImage({ src, alt, ratio = 'aspect-[4/3]', children, sizes = SIZES }: { src: string; alt: string; ratio?: string; children?: React.ReactNode; sizes?: string }) {
  return (
    <div className={cn('relative overflow-hidden', ratio)}>
      <SmartImage src={src} alt={alt} sizes={sizes} width={900} className="transition-transform duration-[1.2s] ease-out group-hover:scale-105" />
      {children}
    </div>
  );
}

export function CauseCard({ cause, featured }: { cause: Cause; featured?: boolean }) {
  return (
    <Link to={`/causes/${cause.slug}`} className={cn('card card-hover group flex h-full flex-col', featured && 'lg:flex-row')}>
      <CardImage src={cause.coverImage} alt={cause.coverAlt || cause.title} ratio={featured ? 'aspect-[4/3] lg:aspect-auto lg:w-3/5' : 'aspect-[4/3]'} sizes={featured ? '(min-width:1024px) 40vw, 100vw' : SIZES}>
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/0 to-black/0" />
        <span className="absolute left-4 top-4 grid h-11 w-11 place-items-center rounded-full bg-white/95 text-primary shadow-lg">
          <Icon name={cause.icon} className="h-5 w-5" />
        </span>
        <SampleBadge show={cause.isSample} className="absolute right-3 top-3" />
      </CardImage>
      <div className={cn('flex flex-1 flex-col p-6', featured && 'lg:justify-center lg:p-10')}>
        <h3 className={cn('font-heading text-2xl', featured && 'lg:text-fs-3')}>{cause.title}</h3>
        <p className="mt-3 line-clamp-3 text-ink-muted">{cause.summary}</p>
        <span className="mt-auto inline-flex items-center gap-1.5 pt-6 text-sm font-semibold text-primary">
          Learn more <ArrowUpRight className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden />
        </span>
      </div>
    </Link>
  );
}

export function CampaignCard({ c }: { c: Campaign }) {
  const phaseBadge = c.phase === 'upcoming' ? <Badge tone="blue">Starts {date(c.startDate)}</Badge> : c.phase === 'completed' ? <Badge tone="neutral">Completed</Badge> : null;
  return (
    <article className="card card-hover group flex h-full flex-col">
      <Link to={`/campaigns/${c.slug}`} className="block" tabIndex={-1} aria-hidden>
        <CardImage src={c.coverImage} alt={c.coverAlt || c.title}>
          <div className="absolute left-4 top-4 flex gap-2">
            {c.cause && <span className="rounded-full bg-white/95 px-3 py-1 text-xs font-semibold text-ink">{c.cause.title}</span>}
            {phaseBadge}
          </div>
          <SampleBadge show={c.isSample} className="absolute right-3 top-3" />
        </CardImage>
      </Link>
      <div className="flex flex-1 flex-col p-6">
        <h3 className="font-heading text-xl leading-snug sm:text-2xl">
          <Link to={`/campaigns/${c.slug}`} className="after:absolute after:inset-0">{c.title}</Link>
        </h3>
        <p className="mt-2 line-clamp-2 text-sm text-ink-muted">{c.summary}</p>
        <div className="mt-auto pt-6">
          <ProgressBar percent={c.percent} label={`${c.percent}% of goal raised`} />
          <div className="mt-3 flex items-baseline justify-between gap-3 text-sm">
            <span>
              <strong className="font-heading text-lg text-ink">{money(c.raised, c.currency)}</strong>
              <span className="text-ink-muted"> of {money(c.goalAmount, c.currency, true)}</span>
            </span>
            <span className="inline-flex items-center gap-1 text-ink-muted">
              <Users className="h-3.5 w-3.5" aria-hidden /> {c.donors}
            </span>
          </div>
        </div>
      </div>
    </article>
  );
}

export function ProjectCard({ p }: { p: Project }) {
  return (
    <Link to={`/projects/${p.slug}`} className="card card-hover group flex h-full flex-col">
      <CardImage src={p.coverImage} alt={p.coverAlt || p.title} ratio="aspect-[16/11]">
        <span className="absolute left-4 top-4 rounded-full bg-white/95 px-3 py-1 text-xs font-semibold capitalize text-ink">{p.phase.toLowerCase()}</span>
        <SampleBadge show={p.isSample} className="absolute right-3 top-3" />
      </CardImage>
      <div className="flex flex-1 flex-col p-6">
        {p.location && (
          <p className="mb-2 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-accent">
            <MapPin className="h-3.5 w-3.5" aria-hidden /> {p.location}
          </p>
        )}
        <h3 className="font-heading text-xl sm:text-2xl">{p.title}</h3>
        <p className="mt-2 line-clamp-3 text-sm text-ink-muted">{p.summary}</p>
      </div>
    </Link>
  );
}

export function StoryCard({ s }: { s: Story }) {
  return (
    <Link to={`/stories/${s.slug}`} className="group relative block overflow-hidden rounded-theme-img">
      <div className="aspect-[3/4]">
        <SmartImage src={s.image} alt={s.imageAlt || s.title} sizes={SIZES} width={900} className="transition-transform duration-[1.2s] group-hover:scale-105" />
      </div>
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />
      <SampleBadge show={s.isSample} className="absolute right-3 top-3" />
      <div className="absolute inset-x-0 bottom-0 p-6 text-white">
        <h3 className="font-heading text-2xl leading-tight">{s.title}</h3>
        <p className="mt-2 line-clamp-2 text-sm text-white/80">{s.excerpt}</p>
      </div>
    </Link>
  );
}

export function EventCard({ e }: { e: EventItem }) {
  const d = new Date(e.startsAt);
  return (
    <Link to={`/events/${e.slug}`} className="card card-hover group flex h-full flex-col sm:flex-row">
      <div className="relative sm:w-2/5">
        <CardImage src={e.coverImage} alt={e.coverAlt || e.title} ratio="aspect-[16/10] sm:aspect-auto sm:h-full" sizes="(min-width:640px) 20vw, 100vw" />
        <div className="absolute left-4 top-4 rounded-xl bg-white/95 px-3 py-2 text-center text-ink shadow-lg">
          <div className="text-[10px] font-bold uppercase tracking-wider text-accent">{d.toLocaleString('en-IN', { month: 'short' })}</div>
          <div className="font-heading text-2xl leading-none">{d.getDate()}</div>
        </div>
      </div>
      <div className="flex flex-1 flex-col p-6">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          {e.status === 'CANCELLED' && <Badge tone="red">Cancelled</Badge>}
          {e.isFundraiser && <Badge tone="brand">Fundraiser</Badge>}
          <SampleBadge show={e.isSample} />
        </div>
        <h3 className="font-heading text-xl">{e.title}</h3>
        <p className="mt-2 line-clamp-2 text-sm text-ink-muted">{e.summary}</p>
        <div className="mt-auto space-y-1 pt-4 text-sm text-ink-muted">
          <p className="inline-flex items-center gap-1.5"><CalendarDays className="h-4 w-4" aria-hidden /> {d.toLocaleString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</p>
          {e.venue && <p className="flex items-center gap-1.5"><MapPin className="h-4 w-4" aria-hidden /> {e.venue}</p>}
        </div>
      </div>
    </Link>
  );
}

export function PostCard({ p }: { p: Post }) {
  return (
    <Link to={`/blog/${p.slug}`} className="group flex h-full flex-col">
      <div className="relative overflow-hidden rounded-theme-img">
        <div className="aspect-[16/10]">
          <SmartImage src={p.coverImage} alt={p.coverAlt || p.title} sizes={SIZES} width={900} className="transition-transform duration-[1.2s] group-hover:scale-105" />
        </div>
        <SampleBadge show={p.isSample} className="absolute right-3 top-3" />
      </div>
      <div className="pt-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-accent">
          {p.category?.name ?? 'News'} · {date(p.publishedAt)}
        </p>
        <h3 className="mt-2 font-heading text-xl leading-snug transition-colors group-hover:text-primary sm:text-2xl">{p.title}</h3>
        <p className="mt-2 line-clamp-2 text-sm text-ink-muted">{p.excerpt}</p>
      </div>
    </Link>
  );
}
