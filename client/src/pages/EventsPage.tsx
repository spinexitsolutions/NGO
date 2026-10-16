import { useSearchParams } from 'react-router-dom';
import { CalendarDays } from 'lucide-react';
import { useCollection } from '@/lib/queries';
import type { EventItem } from '@/lib/types';
import { EmptyState, ErrorState, Skeleton, Tabs } from '@/components/ui';
import { EventCard } from '@/components/site/cards';
import { Reveal } from '@/components/site/motion';
import { CmsPage } from './CmsPage';

const TABS = [
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'past', label: 'Past events' },
] as const;
type When = (typeof TABS)[number]['value'];

function EventListing() {
  const [params, setParams] = useSearchParams();
  const when: When = params.get('when') === 'past' ? 'past' : 'upcoming';
  const { data, isLoading, error, refetch } = useCollection<EventItem>('events', { when, limit: 50 });
  const items = data?.data ?? [];
  return (
    <section className="container-x section-y" aria-labelledby="events-heading">
      <h2 id="events-heading" className="sr-only">Events</h2>
      <Tabs tabs={TABS} value={when} onChange={(v) => setParams(v === 'past' ? { when: v } : {}, { replace: true, preventScrollReset: true })} className="mb-10" />
      <div aria-live="polite">
        {isLoading ? (
          <div className="grid gap-6 lg:grid-cols-2" aria-busy="true">
            {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-64 w-full" />)}
          </div>
        ) : error ? (
          <ErrorState message="We couldn’t load events." onRetry={() => refetch()} />
        ) : items.length === 0 ? (
          <EmptyState icon={CalendarDays} title={when === 'upcoming' ? 'No upcoming events right now' : 'No past events yet'}>
            {when === 'upcoming' ? 'Subscribe to our newsletter to hear about the next one first.' : 'Our event archive will appear here.'}
          </EmptyState>
        ) : (
          <div className="grid gap-6 lg:grid-cols-2">
            {items.map((e, i) => (
              <Reveal key={e.id} delay={(i % 2) * 0.08}><EventCard e={e} /></Reveal>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

export default function EventsPage() {
  return (
    <CmsPage slug="events" fallbackTitle="Events">
      <EventListing />
    </CmsPage>
  );
}
