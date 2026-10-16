import { HandHeart, Search, UserPlus } from 'lucide-react';
import { useCollection } from '@/lib/queries';
import type { Opportunity } from '@/lib/types';
import { ButtonLink, CardGridSkeleton, EmptyState, ErrorState } from '@/components/ui';
import { Reveal } from '@/components/site/motion';
import { SectionHeader } from '@/components/site/SectionHeader';
import { OpportunityCard } from '@/features/sections/DataSections';
import { CmsPage } from './CmsPage';

function Opportunities() {
  const { data, isLoading, error, refetch } = useCollection<Opportunity>('opportunities', { limit: 50 });
  const items = data?.data ?? [];
  return (
    <section className="container-x section-y" aria-label="Volunteer opportunities">
      <SectionHeader eyebrow="Open roles" heading="Volunteer opportunities" intro="Pick a role that fits your skills and schedule — or apply as a general volunteer and we’ll match you." />
      {isLoading ? (
        <CardGridSkeleton count={3} />
      ) : error ? (
        <ErrorState message="We couldn’t load opportunities." onRetry={() => refetch()} />
      ) : items.length === 0 ? (
        <EmptyState icon={HandHeart} title="No open roles right now" action={<ButtonLink href="/volunteer/apply" size="sm">Apply as a general volunteer</ButtonLink>}>
          We’d still love to hear from you — tell us how you’d like to help.
        </EmptyState>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((o, i) => (
            <Reveal key={o.id} delay={(i % 3) * 0.08} className="h-full"><OpportunityCard o={o} /></Reveal>
          ))}
        </div>
      )}

      <Reveal className="mt-16 grid gap-6 overflow-hidden rounded-theme-img bg-secondary p-8 text-white on-dark sm:p-12 md:grid-cols-[1fr_auto] md:items-center">
        <div>
          <p className="eyebrow">Don’t see the right fit?</p>
          <h2 className="mt-3 font-heading text-[1.75rem] leading-tight sm:text-fs-3">Apply as a general volunteer</h2>
          <p className="mt-3 max-w-xl text-white/75">Tell us about your interests, skills and availability. Our volunteer team will be in touch within a few days.</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row md:flex-col">
          <ButtonLink href="/volunteer/apply" variant="accent" icon={UserPlus}>Apply now</ButtonLink>
          <ButtonLink href="/volunteer/status" variant="outline" icon={Search}>Check application status</ButtonLink>
        </div>
      </Reveal>
    </section>
  );
}

export default function VolunteerPage() {
  return (
    <CmsPage slug="volunteer" fallbackTitle="Volunteer with us">
      <Opportunities />
    </CmsPage>
  );
}
