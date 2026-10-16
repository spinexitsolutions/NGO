import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { HandHeart } from 'lucide-react';
import { date, titleCase } from '@/lib/format';
import { EmptyState, StatusBadge, Tabs } from '@/components/ui';
import { AdminPage, DataTable, FilterBar, ListFooter, QueryError, SearchInput, useAdminList, type Column } from '../ui';
import { Chips } from './_common';

interface ApplicationRow {
  id: string;
  reference: string;
  status: string;
  createdAt: string;
  profile: { name: string; email: string; city: string; interests: string[] };
  opportunity: { title: string } | null;
}

const STATUSES = ['SUBMITTED', 'UNDER_REVIEW', 'INFO_REQUESTED', 'APPROVED', 'REJECTED', 'WITHDRAWN'] as const;
type Tab = '' | (typeof STATUSES)[number];

export default function VolunteerApplicationsPage() {
  const [params] = useSearchParams();
  const initial = params.get('status') ?? '';
  const [status, setStatus] = useState<Tab>((STATUSES as readonly string[]).includes(initial) ? (initial as Tab) : '');
  const [q, setQ] = useState('');
  const { rows, meta, isLoading, error, refetch, setPage } = useAdminList<ApplicationRow>('/admin/volunteers/applications', { status, q: q.trim() || undefined }, 'volunteer-applications');
  const counts = (meta?.counts as Record<string, number> | undefined) ?? {};
  const all = Object.values(counts).reduce((a, b) => a + b, 0);

  const tabs = [{ value: '' as Tab, label: <>All <Count n={all} /></> }, ...STATUSES.map((s) => ({ value: s as Tab, label: <>{titleCase(s)} <Count n={counts[s] ?? 0} /></> }))];

  const columns: Column<ApplicationRow>[] = [
    { key: 'name', header: 'Applicant', render: (a) => <span>{a.profile.name}</span> },
    { key: 'ref', header: 'Reference', render: (a) => <span className="font-mono text-xs">{a.reference}</span> },
    { key: 'contact', header: 'Email / city', render: (a) => <div><p>{a.profile.email}</p><p className="text-xs text-ink-muted">{a.profile.city}</p></div> },
    { key: 'opp', header: 'Opportunity', render: (a) => a.opportunity?.title ?? <span className="text-ink-muted">General</span> },
    { key: 'interests', header: 'Interests', render: (a) => <div className="min-w-[10rem]"><Chips items={a.profile.interests.slice(0, 3)} /></div> },
    { key: 'date', header: 'Applied', render: (a) => <span className="whitespace-nowrap">{date(a.createdAt)}</span> },
    { key: 'status', header: 'Status', render: (a) => <StatusBadge status={a.status} /> },
  ];

  return (
    <AdminPage title="Volunteer applications" description="Review new applicants, request more information, and approve volunteers.">
      <Tabs className="mb-4" tabs={tabs} value={status} onChange={(v) => { setStatus(v); setPage(1); }} />
      <FilterBar>
        <SearchInput value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Name, email, city or reference…" />
      </FilterBar>
      {error ? (
        <QueryError error={error} retry={refetch} />
      ) : (
        <>
          <DataTable rows={rows} columns={columns} loading={isLoading} rowHref={(a) => `/admin/volunteers/applications/${a.id}`} empty={<EmptyState icon={HandHeart} title="No applications here">{status ? 'Nothing with this status right now.' : 'New applications from the website will appear here.'}</EmptyState>} />
          <ListFooter meta={meta} setPage={setPage} />
        </>
      )}
    </AdminPage>
  );
}

function Count({ n }: { n: number }) {
  return <span className="ml-1 rounded-full bg-ink/[0.07] px-1.5 py-0.5 text-[11px] font-semibold text-ink-muted">{n}</span>;
}
