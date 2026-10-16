import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Megaphone, Search, X } from 'lucide-react';
import { get, qs } from '@/lib/api';
import { useCollection } from '@/lib/queries';
import type { Campaign, Cause } from '@/lib/types';
import { CardGridSkeleton, EmptyState, ErrorState, Select, Tabs } from '@/components/ui';
import { CampaignCard } from '@/components/site/cards';
import { Reveal } from '@/components/site/motion';
import { CmsPage } from './CmsPage';
import { useDebounced } from './page-kit';

const PHASES = [
  { value: 'active', label: 'Active' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'completed', label: 'Completed' },
  { value: 'all', label: 'All' },
] as const;
type Phase = (typeof PHASES)[number]['value'];

function CampaignListing() {
  const [params, setParams] = useSearchParams();
  const phase = (PHASES.find((p) => p.value === params.get('phase'))?.value ?? 'active') as Phase;
  const cause = params.get('cause') ?? '';
  const q = params.get('q') ?? '';
  const dq = useDebounced(q.trim(), 350);
  const causes = useCollection<Cause>('causes', { limit: 50 });

  const update = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true, preventScrollReset: true });
  };

  const list = useQuery({
    queryKey: ['campaigns', phase, cause, dq],
    queryFn: () => get<Campaign[]>(`/public/campaigns${qs({ phase, cause, q: dq, limit: 50 })}`),
    staleTime: 60_000,
    placeholderData: (prev) => prev,
  });
  const items = list.data ?? [];
  const filtered = Boolean(cause || dq);

  return (
    <section className="container-x section-y" aria-labelledby="campaigns-heading">
      <h2 id="campaigns-heading" className="sr-only">Browse campaigns</h2>
      <div className="mb-10 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <Tabs tabs={PHASES} value={phase} onChange={(v) => update('phase', v === 'active' ? '' : v)} className="lg:border-b-0" />
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative sm:w-72">
            <label htmlFor="campaign-search" className="sr-only">Search campaigns</label>
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" aria-hidden />
            <input id="campaign-search" type="search" value={q} onChange={(e) => update('q', e.target.value)} placeholder="Search campaigns" className="input pl-11" />
          </div>
          <div className="sm:w-60">
            <label htmlFor="campaign-cause" className="sr-only">Filter by cause</label>
            <Select id="campaign-cause" value={cause} onChange={(e) => update('cause', e.target.value)}>
              <option value="">All causes</option>
              {(causes.data?.data ?? []).map((c) => (
                <option key={c.id} value={c.slug}>{c.title}</option>
              ))}
            </Select>
          </div>
        </div>
      </div>

      <div aria-live="polite" aria-busy={list.isFetching || undefined}>
        {list.isLoading ? (
          <CardGridSkeleton count={6} />
        ) : list.error ? (
          <ErrorState message="We couldn’t load campaigns." onRetry={() => list.refetch()} />
        ) : items.length === 0 ? (
          <EmptyState
            icon={Megaphone}
            title={filtered ? 'No campaigns match your search' : phase === 'upcoming' ? 'No upcoming campaigns yet' : phase === 'completed' ? 'No completed campaigns yet' : 'No active campaigns right now'}
            action={
              filtered ? (
                <button className="btn btn-outline btn-sm" onClick={() => setParams(phase === 'active' ? {} : { phase }, { replace: true })}>
                  <X className="h-4 w-4" aria-hidden /> Clear filters
                </button>
              ) : undefined
            }
          >
            {filtered ? 'Try a different word or cause.' : 'You can still make a general donation that goes where it’s needed most.'}
          </EmptyState>
        ) : (
          <>
            <p className="mb-6 text-sm text-ink-muted">{items.length === 1 ? '1 campaign' : `${items.length} campaigns`}</p>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((c, i) => (
                <Reveal key={c.id} delay={(i % 3) * 0.08}>
                  <CampaignCard c={c} />
                </Reveal>
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}

export default function CampaignsPage() {
  return (
    <CmsPage slug="campaigns" fallbackTitle="Campaigns">
      <CampaignListing />
    </CmsPage>
  );
}
