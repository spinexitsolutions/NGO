import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowUpRight, FileText, Search as SearchIcon } from 'lucide-react';
import { get } from '@/lib/api';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui';
import { Seo } from '@/components/site/Seo';
import { SmartImage } from '@/components/site/SmartImage';
import { useDebounced } from './page-kit';

interface Hit { type: string; href: string; title: string; text: string; image: string }
const ORDER = ['Cause', 'Campaign', 'Project', 'Story', 'Article', 'Event', 'Page'];
const PLURAL: Record<string, string> = { Cause: 'Causes', Campaign: 'Campaigns', Project: 'Projects', Story: 'Stories', Article: 'Articles', Event: 'Events', Page: 'Pages' };

export default function SearchPage() {
  const [params, setParams] = useSearchParams();
  const urlQ = params.get('q') ?? '';
  const [q, setQ] = useState(urlQ);
  const dq = useDebounced(q.trim(), 300);

  useEffect(() => {
    if (dq !== urlQ) setParams(dq ? { q: dq } : {}, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dq]);

  // Keep the box in sync when the URL changes from elsewhere (e.g. the header search).
  useEffect(() => {
    if (urlQ !== q.trim()) setQ(urlQ);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlQ]);

  const enabled = urlQ.trim().length >= 2;
  const res = useQuery({ queryKey: ['search', urlQ], queryFn: () => get<Hit[]>(`/public/search?q=${encodeURIComponent(urlQ)}`), enabled, staleTime: 30_000, placeholderData: (p) => p });
  const hits = enabled ? res.data ?? [] : [];
  const groups = ORDER.map((t) => ({ type: t, items: hits.filter((h) => h.type === t) })).filter((g) => g.items.length);

  return (
    <>
      <Seo title={urlQ ? `Search: ${urlQ}` : 'Search'} noIndex />
      <section className="container-x section-y">
        <div className="mx-auto max-w-3xl">
          <h1 className="h-section">Search</h1>
          <form role="search" onSubmit={(e) => { e.preventDefault(); setParams(q.trim() ? { q: q.trim() } : {}, { replace: true }); }} className="relative mt-8">
            <label htmlFor="site-search" className="sr-only">Search the site</label>
            <SearchIcon className="pointer-events-none absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-muted" aria-hidden />
            <input id="site-search" type="search" autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search causes, campaigns, stories, events…" className="input h-16 rounded-full pl-14 text-lg" />
          </form>

          <div className="mt-10" aria-live="polite" aria-busy={res.isFetching || undefined}>
            {!enabled ? (
              <p className="text-center text-ink-muted">{q.trim().length === 1 ? 'Keep typing — at least 2 characters.' : 'Type at least 2 characters to search.'}</p>
            ) : res.isLoading ? (
              <div className="space-y-4" aria-label="Loading">
                {[0, 1, 2].map((i) => <div key={i} className="flex gap-4"><Skeleton className="h-20 w-20 shrink-0" /><div className="flex-1 space-y-2"><Skeleton className="h-5 w-1/2" /><Skeleton className="h-4 w-full" /></div></div>)}
              </div>
            ) : res.error ? (
              <ErrorState message="Search isn’t available right now." onRetry={() => res.refetch()} />
            ) : hits.length === 0 ? (
              <EmptyState icon={SearchIcon} title={`No results for “${urlQ}”`}>Try a different or shorter word, or browse our <Link to="/causes" className="text-primary underline">causes</Link> and <Link to="/blog" className="text-primary underline">news</Link>.</EmptyState>
            ) : (
              <>
                <p className="mb-8 text-sm text-ink-muted">{hits.length} result{hits.length === 1 ? '' : 's'} for “{urlQ}”</p>
                <div className="space-y-12">
                  {groups.map((g) => (
                    <section key={g.type} aria-labelledby={`group-${g.type}`}>
                      <h2 id={`group-${g.type}`} className="eyebrow mb-4">{PLURAL[g.type] ?? g.type}</h2>
                      <ul className="divide-y divide-line overflow-hidden rounded-theme-img border border-line bg-surface">
                        {g.items.map((h) => (
                          <li key={h.href}>
                            <Link to={h.href} className="group flex items-center gap-4 p-4 transition hover:bg-surface-alt/50 sm:p-5">
                              <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl sm:h-20 sm:w-20">
                                {h.image ? <SmartImage src={h.image} alt="" sizes="80px" width={200} /> : <span className="grid h-full w-full place-items-center bg-primary/10 text-primary"><FileText className="h-6 w-6" aria-hidden /></span>}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="font-heading text-lg leading-snug group-hover:text-primary">{h.title}</p>
                                {h.text && <p className="mt-1 line-clamp-2 text-sm text-ink-muted">{h.text}</p>}
                              </div>
                              <ArrowUpRight className="h-4 w-4 shrink-0 text-ink-muted transition group-hover:text-primary" aria-hidden />
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </section>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
