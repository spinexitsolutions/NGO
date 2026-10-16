import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Newspaper, Search, Tag, X } from 'lucide-react';
import { api, qs } from '@/lib/api';
import { cn } from '@/lib/cn';
import type { Post } from '@/lib/types';
import { CardGridSkeleton, EmptyState, ErrorState, Pagination } from '@/components/ui';
import { PostCard } from '@/components/site/cards';
import { Reveal } from '@/components/site/motion';
import { CmsPage } from './CmsPage';
import { useDebounced } from './page-kit';

interface PostsResponse { data: Post[]; meta: { page: number; pages: number; total: number; categories: { name: string; slug: string }[] } }

function BlogListing() {
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Number(params.get('page')) || 1);
  const category = params.get('category') ?? '';
  const tag = params.get('tag') ?? '';
  const urlQ = params.get('q') ?? '';
  const [q, setQ] = useState(urlQ);
  const dq = useDebounced(q.trim(), 400);

  const set = (patch: Record<string, string>, resetPage = true) => {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    if (resetPage) next.delete('page');
    setParams(next, { replace: true, preventScrollReset: true });
  };

  // Sync the debounced search box into the URL.
  useEffect(() => {
    if (dq !== urlQ.trim()) set({ q: dq });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dq]);

  const list = useQuery({
    queryKey: ['posts', page, category, tag, urlQ],
    queryFn: () => api<PostsResponse>(`/public/posts${qs({ page, category, tag, q: urlQ, limit: 9 })}`),
    staleTime: 60_000,
    placeholderData: (prev) => prev,
  });
  const posts = list.data?.data ?? [];
  const meta = list.data?.meta;
  const categories = meta?.categories ?? [];
  const filtered = Boolean(category || tag || urlQ);

  const chip = (active: boolean) => cn('whitespace-nowrap rounded-full border px-4 py-2 text-sm font-medium transition', active ? 'border-primary bg-primary text-primary-contrast' : 'border-line bg-surface text-ink-muted hover:border-primary/50 hover:text-ink');

  return (
    <section className="container-x section-y" aria-labelledby="blog-heading">
      <h2 id="blog-heading" className="sr-only">Articles</h2>
      <div className="mb-10 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 sm:mx-0 sm:flex-wrap sm:px-0" role="group" aria-label="Filter by category">
          <button type="button" className={chip(!category)} aria-pressed={!category} onClick={() => set({ category: '' })}>All</button>
          {categories.map((c) => (
            <button key={c.slug} type="button" className={chip(category === c.slug)} aria-pressed={category === c.slug} onClick={() => set({ category: c.slug })}>{c.name}</button>
          ))}
        </div>
        <div className="relative lg:w-80">
          <label htmlFor="blog-search" className="sr-only">Search articles</label>
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" aria-hidden />
          <input id="blog-search" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search articles" className="input pl-11" />
        </div>
      </div>

      {tag && (
        <div className="mb-8 flex items-center gap-2 text-sm">
          <span className="text-ink-muted">Tagged</span>
          <button type="button" onClick={() => set({ tag: '' })} className="chip border-primary/40 text-primary" aria-label={`Remove tag filter ${tag}`}>
            <Tag className="h-3 w-3" aria-hidden /> {tag} <X className="h-3 w-3" aria-hidden />
          </button>
        </div>
      )}

      <div aria-live="polite" aria-busy={list.isFetching || undefined}>
        {list.isLoading ? (
          <CardGridSkeleton count={6} />
        ) : list.error ? (
          <ErrorState message="We couldn’t load articles." onRetry={() => list.refetch()} />
        ) : posts.length === 0 ? (
          <EmptyState
            icon={Newspaper}
            title={filtered ? 'No articles match' : 'No articles yet'}
            action={filtered ? <button className="btn btn-outline btn-sm" onClick={() => { setQ(''); setParams({}, { replace: true }); }}>Clear filters</button> : undefined}
          >
            {filtered ? 'Try a different search, category or tag.' : 'News and updates will appear here.'}
          </EmptyState>
        ) : (
          <>
            {meta && filtered && <p className="mb-6 text-sm text-ink-muted">{meta.total === 1 ? '1 article' : `${meta.total} articles`}</p>}
            <div className={cn('grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3 transition-opacity', list.isFetching && 'opacity-60')}>
              {posts.map((p, i) => (
                <Reveal key={p.id} delay={(i % 3) * 0.08}><PostCard p={p} /></Reveal>
              ))}
            </div>
            {meta && (
              <div className="mt-12">
                <Pagination page={meta.page} pages={meta.pages} onChange={(n) => { set({ page: n > 1 ? String(n) : '' }, false); window.scrollTo({ top: 0, behavior: 'smooth' }); }} />
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}

export default function BlogPage() {
  return (
    <CmsPage slug="blog" fallbackTitle="News & stories">
      <BlogListing />
    </CmsPage>
  );
}
