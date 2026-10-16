import { useSearchParams } from 'react-router-dom';
import { FolderKanban, X } from 'lucide-react';
import { useCollection } from '@/lib/queries';
import type { Cause, Project } from '@/lib/types';
import { CardGridSkeleton, EmptyState, ErrorState, Select, Tabs } from '@/components/ui';
import { ProjectCard } from '@/components/site/cards';
import { Reveal } from '@/components/site/motion';
import { CmsPage } from './CmsPage';

const PHASES = [
  { value: 'all', label: 'All projects' },
  { value: 'ONGOING', label: 'Ongoing' },
  { value: 'PLANNED', label: 'Planned' },
  { value: 'COMPLETED', label: 'Completed' },
] as const;
type Phase = (typeof PHASES)[number]['value'];

function ProjectListing() {
  const [params, setParams] = useSearchParams();
  const phase = (PHASES.find((p) => p.value === params.get('phase'))?.value ?? 'all') as Phase;
  const cause = params.get('cause') ?? '';
  const causes = useCollection<Cause>('causes', { limit: 50 });
  const list = useCollection<Project>('projects', { phase, cause: cause || undefined, limit: 50 });
  const items = list.data?.data ?? [];

  const update = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value && value !== 'all') next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true, preventScrollReset: true });
  };

  return (
    <section className="container-x section-y" aria-labelledby="projects-heading">
      <h2 id="projects-heading" className="sr-only">Browse projects</h2>
      <div className="mb-10 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <Tabs tabs={PHASES} value={phase} onChange={(v) => update('phase', v)} className="md:border-b-0" />
        <div className="md:w-64">
          <label htmlFor="project-cause" className="sr-only">Filter by cause</label>
          <Select id="project-cause" value={cause} onChange={(e) => update('cause', e.target.value)}>
            <option value="">All causes</option>
            {(causes.data?.data ?? []).map((c) => <option key={c.id} value={c.slug}>{c.title}</option>)}
          </Select>
        </div>
      </div>
      <div aria-live="polite">
        {list.isLoading ? (
          <CardGridSkeleton count={6} />
        ) : list.error ? (
          <ErrorState message="We couldn’t load projects." onRetry={() => list.refetch()} />
        ) : items.length === 0 ? (
          <EmptyState
            icon={FolderKanban}
            title="No projects match these filters"
            action={phase !== 'all' || cause ? <button className="btn btn-outline btn-sm" onClick={() => setParams({}, { replace: true })}><X className="h-4 w-4" aria-hidden /> Clear filters</button> : undefined}
          >
            Try another phase or cause.
          </EmptyState>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((p, i) => (
              <Reveal key={p.id} delay={(i % 3) * 0.08}><ProjectCard p={p} /></Reveal>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

export default function ProjectsPage() {
  return (
    <CmsPage slug="projects" fallbackTitle="Our projects">
      <ProjectListing />
    </CmsPage>
  );
}
