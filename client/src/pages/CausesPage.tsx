import { Compass } from 'lucide-react';
import { useCollection } from '@/lib/queries';
import type { Cause } from '@/lib/types';
import { CardGridSkeleton, EmptyState, ErrorState } from '@/components/ui';
import { CauseCard } from '@/components/site/cards';
import { Reveal } from '@/components/site/motion';
import { CmsPage } from './CmsPage';

function CausesGrid() {
  const { data, isLoading, error, refetch } = useCollection<Cause>('causes', { limit: 50 });
  const items = data?.data ?? [];
  return (
    <section className="container-x section-y" aria-label="All causes">
      {isLoading ? (
        <CardGridSkeleton count={6} />
      ) : error ? (
        <ErrorState message="We couldn’t load our causes." onRetry={() => refetch()} />
      ) : items.length === 0 ? (
        <EmptyState icon={Compass} title="Causes coming soon">We’re preparing details of the areas we work in. Please check back shortly.</EmptyState>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((c, i) => (
            <Reveal key={c.id} delay={(i % 3) * 0.08} className={i === 0 && items.length > 3 ? 'sm:col-span-2 lg:col-span-3' : undefined}>
              <CauseCard cause={c} featured={i === 0 && items.length > 3} />
            </Reveal>
          ))}
        </div>
      )}
    </section>
  );
}

export default function CausesPage() {
  return (
    <CmsPage slug="causes" fallbackTitle="Our causes">
      <CausesGrid />
    </CmsPage>
  );
}
