import { useState } from 'react';
import { Users } from 'lucide-react';
import { qs } from '@/lib/api';
import { date, money } from '@/lib/format';
import { useAuth } from '@/app/AuthProvider';
import { Badge, EmptyState } from '@/components/ui';
import { AdminPage, DataTable, ExportButton, FilterBar, ListFooter, QueryError, SearchInput, useAdminList, type Column } from '../ui';
import { isoDay } from './_common';

interface DonorRow {
  id: string;
  name: string;
  email: string;
  phone: string;
  marketingOptIn: boolean;
  doNotContact: boolean;
  createdAt: string;
  totalGiven: number;
  gifts: number;
  lastGiftAt: string | null;
}

export default function DonorsPage() {
  const { can } = useAuth();
  const [q, setQ] = useState('');
  const filters = { q: q.trim() || undefined };
  const { rows, meta, isLoading, error, refetch, setPage } = useAdminList<DonorRow>('/admin/donors', filters, 'donors');

  const columns: Column<DonorRow>[] = [
    { key: 'name', header: 'Donor', render: (d) => <span>{d.name}</span> },
    { key: 'contact', header: 'Contact', render: (d) => <div><p>{d.email}</p>{d.phone && <p className="text-xs text-ink-muted">{d.phone}</p>}</div> },
    { key: 'total', header: 'Total given', className: 'text-right', render: (d) => <span className="block whitespace-nowrap text-right font-semibold">{money(d.totalGiven)}</span> },
    { key: 'gifts', header: 'Gifts', className: 'text-right', render: (d) => <span className="block text-right">{d.gifts}</span> },
    { key: 'last', header: 'Last gift', render: (d) => <span className="whitespace-nowrap">{d.lastGiftAt ? date(d.lastGiftAt) : <span className="text-ink-muted">—</span>}</span> },
    {
      key: 'prefs',
      header: 'Preferences',
      render: (d) => (
        <span className="flex flex-wrap gap-1">
          {d.marketingOptIn && <Badge tone="green">Opted in</Badge>}
          {d.doNotContact && <Badge tone="red">Do not contact</Badge>}
          {!d.marketingOptIn && !d.doNotContact && <span className="text-ink-muted">—</span>}
        </span>
      ),
    },
    { key: 'since', header: 'Since', render: (d) => <span className="whitespace-nowrap">{date(d.createdAt)}</span> },
  ];

  return (
    <AdminPage
      title="Donors"
      description="Everyone who has given. Totals are net of refunds and include only successful donations."
      actions={can('donations.export') ? <ExportButton path={`/admin/donors${qs({ ...filters, format: 'csv' })}`} filename={`donors-${isoDay()}.csv`} /> : undefined}
    >
      <FilterBar>
        <SearchInput value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Name, email or phone…" />
      </FilterBar>
      {error ? (
        <QueryError error={error} retry={refetch} />
      ) : (
        <>
          <DataTable rows={rows} columns={columns} loading={isLoading} rowHref={(d) => `/admin/donors/${d.id}`} empty={<EmptyState icon={Users} title={q ? 'No donors match your search' : 'No donors yet'} />} />
          <ListFooter meta={meta} setPage={setPage} />
        </>
      )}
    </AdminPage>
  );
}
