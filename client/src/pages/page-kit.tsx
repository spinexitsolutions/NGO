/**
 * Small helpers shared by the public page components in this folder (detail banners, query
 * gates, lists). Kept here so the page files stay focused on their own content.
 */
import { lazy, Suspense, useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Check, ChevronLeft } from 'lucide-react';
import type { UseQueryResult } from '@tanstack/react-query';
import { useMotionEnabled, useSite } from '@/app/SiteProvider';
import { ApiError } from '@/lib/api';
import { cn } from '@/lib/cn';
import { ErrorState, Skeleton } from '@/components/ui';
import { useHeaderOverlay } from '@/components/site/Layout';
import { SmartImage } from '@/components/site/SmartImage';
import { SampleBadge } from '@/components/site/SampleBadge';
import { Reveal } from '@/components/site/motion';
import type { GalleryImage } from '@/components/site/Lightbox';

const NotFoundPage = lazy(() => import('./NotFoundPage'));

export function NotFound() {
  return (
    <Suspense fallback={null}>
      <NotFoundPage />
    </Suspense>
  );
}

export const isNotFound = (e: unknown) => e instanceof ApiError && e.status === 404;

/** Debounces a fast-changing value (search boxes). */
export function useDebounced<T>(value: T, ms = 350): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = window.setTimeout(() => setV(value), ms);
    return () => window.clearTimeout(id);
  }, [value, ms]);
  return v;
}

/** Turns the transparent header on while a full-bleed banner is on screen. Returns whether it applies. */
export function useOverlayHeader(enabled = true) {
  const setOverlay = useHeaderOverlay();
  const { theme } = useSite();
  const on = enabled && theme.layout.headerStyle === 'transparent';
  useEffect(() => {
    setOverlay(on);
    return () => setOverlay(false);
  }, [on, setOverlay]);
  return on;
}

/** Cinematic full-bleed image banner with the title over a gradient. */
export function DetailBanner({
  image,
  alt,
  eyebrow,
  title,
  subtitle,
  isSample,
  back,
  children,
  size = 'large',
}: {
  image?: string | null;
  alt?: string;
  eyebrow?: ReactNode;
  title: string;
  subtitle?: ReactNode;
  isSample?: boolean;
  back?: { href: string; label: string };
  children?: ReactNode;
  size?: 'large' | 'medium';
}) {
  const overlay = useOverlayHeader();
  const motionOn = useMotionEnabled();
  const anim = (delay: number) => (motionOn ? { initial: { opacity: 0, y: 18 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.9, delay, ease: [0.22, 1, 0.36, 1] } } : {});
  return (
    <section className={cn('on-dark relative flex items-end overflow-hidden bg-secondary text-white', size === 'large' ? 'min-h-[68svh] sm:min-h-[72svh]' : 'min-h-[52svh]', overlay && '-mt-20')} aria-label={title}>
      <div className="absolute inset-0">
        <div className={cn('h-full w-full', motionOn && 'animate-kenburns')}>
          <SmartImage src={image} alt={alt || title} priority sizes="100vw" width={2400} />
        </div>
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgb(0_0_0/0.45)_0%,rgb(0_0_0/0.15)_40%,rgb(var(--c-secondary)/0.94)_100%)]" />
      </div>
      <div className="container-x relative pb-14 pt-36 sm:pb-20">
        {back && (
          <Link to={back.href} className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-white/80 transition hover:text-white">
            <ChevronLeft className="h-4 w-4" aria-hidden /> {back.label}
          </Link>
        )}
        <div className="max-w-4xl">
          {(eyebrow || isSample) && (
            <motion.div {...anim(0)} className="mb-5 flex flex-wrap items-center gap-3">
              {eyebrow && <p className="eyebrow text-accent">{eyebrow}</p>}
              <SampleBadge show={isSample} />
            </motion.div>
          )}
          <motion.h1 {...anim(0.08)} className="h-display text-shadow break-words">
            {title}
          </motion.h1>
          {subtitle && (
            <motion.div {...anim(0.2)} className="mt-6 max-w-2xl text-lg leading-relaxed text-white/85 sm:text-xl">
              {subtitle}
            </motion.div>
          )}
          {children && <motion.div {...anim(0.32)} className="mt-8">{children}</motion.div>}
        </div>
      </div>
    </section>
  );
}

/** Skeleton for a detail page while it loads. */
export function DetailSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading">
      <Skeleton className="h-[52svh] w-full rounded-none" />
      <div className="container-x grid gap-10 py-16 lg:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-4/6" />
        </div>
        <Skeleton className="h-72 w-full" />
      </div>
    </div>
  );
}

/** Skeleton for article-style pages (stories, blog posts). */
export function ArticleSkeleton() {
  return (
    <div className="container-x py-16" aria-busy="true" aria-label="Loading">
      <div className="mx-auto max-w-3xl space-y-4">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-5 w-2/3" />
      </div>
      <Skeleton className="mx-auto mt-10 aspect-[16/9] w-full max-w-5xl" />
      <div className="mx-auto mt-10 max-w-3xl space-y-3">
        {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-4 w-full" />)}
      </div>
    </div>
  );
}

/** Loading / 404 / error handling for a single-record query; renders children with the data. */
export function QueryGate<T>({ query, children, skeleton }: { query: UseQueryResult<T>; children: (data: T) => ReactNode; skeleton?: ReactNode }) {
  if (query.isLoading) return <>{skeleton ?? <DetailSkeleton />}</>;
  if (isNotFound(query.error)) return <NotFound />;
  if (query.error || query.data === undefined)
    return (
      <div className="container-x py-24">
        <ErrorState message="We couldn’t load this page. Please check your connection and try again." onRetry={() => query.refetch()} />
      </div>
    );
  return <>{children(query.data)}</>;
}

/** Checkmarked list used for goals, objectives, activities and outcomes. */
export function TickList({ title, items, className }: { title: string; items?: string[]; className?: string }) {
  const list = (items ?? []).filter(Boolean);
  if (!list.length) return null;
  return (
    <Reveal className={cn('card p-6 sm:p-7', className)}>
      <h3 className="font-heading text-xl">{title}</h3>
      <ul className="mt-4 space-y-3">
        {list.map((item, i) => (
          <li key={i} className="flex gap-3 text-ink-muted">
            <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
              <Check className="h-3 w-3" aria-hidden />
            </span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </Reveal>
  );
}

/** Section wrapper with a heading for detail pages. */
export function Block({ title, eyebrow, children, className, id, action }: { title: string; eyebrow?: string; children: ReactNode; className?: string; id?: string; action?: ReactNode }) {
  return (
    <section className={cn('mt-16 first:mt-0', className)} aria-labelledby={id}>
      <Reveal className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          {eyebrow && <p className="eyebrow mb-3">{eyebrow}</p>}
          <h2 id={id} className="font-heading text-[1.75rem] leading-tight sm:text-fs-3">{title}</h2>
        </div>
        {action}
      </Reveal>
      {children}
    </section>
  );
}

export const toGallery = (urls: string[] | undefined, alt: string): GalleryImage[] => (urls ?? []).filter(Boolean).map((url, i) => ({ url, alt: `${alt} — photo ${i + 1}` }));

/** Absolute URL of the current page without query string (for share links / JSON-LD). */
export const pageUrl = () => (typeof window !== 'undefined' ? `${window.location.origin}${window.location.pathname}` : '');

/** Reads a stored UTM object (set by the donate page) safely. */
export function readSession(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}
export function writeSession(key: string, value: string) {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    /* storage unavailable */
  }
}
