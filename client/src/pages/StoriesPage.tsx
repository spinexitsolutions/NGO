import { BookHeart } from 'lucide-react';
import { useCollection } from '@/lib/queries';
import type { Story } from '@/lib/types';
import { CardGridSkeleton, EmptyState, ErrorState } from '@/components/ui';
import { StoryCard } from '@/components/site/cards';
import { Reveal } from '@/components/site/motion';
import { CmsPage } from './CmsPage';

function StoriesGrid() {
  const { data, isLoading, error, refetch } = useCollection<Story>('stories', { limit: 50 });
  const items = data?.data ?? [];
  return (
    <section className="container-x section-y" aria-label="All stories">
      {isLoading ? (
        <CardGridSkeleton count={6} />
      ) : error ? (
        <ErrorState message="We couldn’t load stories." onRetry={() => refetch()} />
      ) : items.length === 0 ? (
        <EmptyState icon={BookHeart} title="Stories coming soon">We share stories only with the consent of the people in them. New stories will appear here.</EmptyState>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((s, i) => (
            <Reveal key={s.id} delay={(i % 3) * 0.08}><StoryCard s={s} /></Reveal>
          ))}
        </div>
      )}
    </section>
  );
}

export default function StoriesPage() {
  return (
    <CmsPage slug="stories" fallbackTitle="Stories of change">
      <StoriesGrid />
    </CmsPage>
  );
}
