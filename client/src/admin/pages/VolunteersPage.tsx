import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Users } from 'lucide-react';
import { qs } from '@/lib/api';
import { date } from '@/lib/format';
import { useAuth } from '@/app/AuthProvider';
import { EmptyState, StatusBadge } from '@/components/ui';
import { AdminPage, AdminSelect, DataTable, ExportButton, FilterBar, ListFooter, QueryError, SearchInput, useAdminList, type Column } from '../ui';
import { Chips, isoDay } from './_common';

interface ProfileRow {
  id: string;
  name: string;
  email: string;
  phone: string;
  city: string;
  status: string;
  roleTitle: string;
  skills: string[];
  availability: string;
  hours: number;
  createdAt: string;
}

export default function VolunteersPage() {
  const { can } = useAuth();
  const [params] = useSearchParams();
  const [status, setStatus] = useState(params.get('status') ?? '');
  const [q, setQ] = useState('');
  const filters = { status, q: q.trim() || undefined };
  const { rows, meta, isLoading, error, refetch, setPage } = useAdminList<ProfileRow>('/admin/volunteers/profiles', filters, 'volunteers');

  const columns: Column<ProfileRow>[] = [
    { key: 'name', header: 'Volunteer', render: (v) => <span>{v.name}</span> },
    { key: 'contact', header: 'Contact', render: (v) => <div><p>{v.email}</p><p className="text-xs text-ink-muted">{v.phone}</p></div> },
    { key: 'city', header: 'City', render: (v) => v.city },
    { key: 'role', header: 'Role', render: (v) => v.roleTitle || <span className="text-ink-muted">—</span> },
    { key: 'skills', header: 'Skills', render: (v) => <div className="min-w-[10rem]"><Chips items={v.skills.slice(0, 3)} /></div> },
    { key: 'hours', header: 'Hours', className: 'text-right', render: (v) => <span className="block text-right font-semibold">{v.hours.toLocaleString('en-IN')}</span> },
    { key: 'since', header: 'Joined', render: (v) => <span className="whitespace-nowrap">{date(v.createdAt)}</span> },
    { key: 'status', header: 'Status', render: (v) => <StatusBadge status={v.status} /> },
  ];

  return (
    <AdminPage
      title="Volunteers"
      description="Volunteer profiles, their assignments and logged hours."
      actions={can('volunteers.manage') ? <ExportButton path={`/admin/volunteers/profiles${qs({ ...filters, format: 'csv' })}`} filename={`volunteers-${isoDay()}.csv`} /> : undefined}
    >
      <FilterBar>
        <SearchInput value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Name, email, city or skill…" />
        <AdminSelect label="Status" value={status} onChange={(v) => { setStatus(v); setPage(1); }} options={[{ value: '', label: 'All statuses' }, { value: 'ACTIVE', label: 'Active' }, { value: 'APPLICANT', label: 'Applicant' }, { value: 'INACTIVE', label: 'Inactive' }]} />
      </FilterBar>
      {error ? (
        <QueryError error={error} retry={refetch} />
      ) : (
        <>
          <DataTable rows={rows} columns={columns} loading={isLoading} rowHref={(v) => `/admin/volunteers/${v.id}`} empty={<EmptyState icon={Users} title="No volunteers found" />} />
          <ListFooter meta={meta} setPage={setPage} />
        </>
      )}
    </AdminPage>
  );
}
