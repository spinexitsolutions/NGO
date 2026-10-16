import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Repeat } from 'lucide-react';
import { get, send } from '@/lib/api';
import { date, money, titleCase } from '@/lib/format';
import { useAuth } from '@/app/AuthProvider';
import { Button, EmptyState, StatusBadge, useConfirm } from '@/components/ui';
import { AdminPage, AdminSelect, DataTable, FilterBar, QueryError, SearchInput, StatCard, type Column } from '../ui';
import { useApiMutation } from './_common';

interface RecurringRow {
  id: string;
  reference: string;
  amount: number;
  currency: string;
  status: string;
  provider: string;
  providerSubscriptionId: string;
  createdAt: string;
  donorId: string;
  donor: { name: string; email: string };
  campaign: { title: string } | null;
  _count: { donations: number };
}

const STATUSES = ['CREATED', 'ACTIVE', 'HALTED', 'CANCELLED', 'COMPLETED'];

export default function RecurringPage() {
  const { can } = useAuth();
  const confirm = useConfirm();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const key = ['admin', 'recurring'];
  const { data, isLoading, error, refetch } = useQuery({ queryKey: key, queryFn: () => get<RecurringRow[]>('/admin/donations/recurring/list') });
  const cancel = useApiMutation((id: string) => send(`/admin/donations/recurring/${id}/cancel`), { success: 'Monthly donation cancelled', invalidate: [key] });

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (data ?? []).filter((r) => (!status || r.status === status) && (!term || [r.reference, r.donor.name, r.donor.email, r.campaign?.title ?? ''].some((s) => s.toLowerCase().includes(term))));
  }, [data, q, status]);
  const active = (data ?? []).filter((r) => r.status === 'ACTIVE');
  const mrr = active.reduce((n, r) => n + r.amount, 0);

  const columns: Column<RecurringRow>[] = [
    { key: 'ref', header: 'Reference', render: (r) => <span className="font-mono text-xs">{r.reference}</span> },
    { key: 'donor', header: 'Donor', render: (r) => <Link to={`/admin/donors/${r.donorId}`} className="hover:text-primary"><p className="font-medium">{r.donor.name}</p><p className="text-xs text-ink-muted">{r.donor.email}</p></Link> },
    { key: 'amount', header: 'Monthly', className: 'text-right', render: (r) => <span className="block whitespace-nowrap text-right font-semibold">{money(r.amount, r.currency)}</span> },
    { key: 'campaign', header: 'Campaign', render: (r) => r.campaign?.title ?? <span className="text-ink-muted">General fund</span> },
    { key: 'payments', header: 'Payments', className: 'text-right', render: (r) => <span className="block text-right">{r._count.donations}</span> },
    { key: 'since', header: 'Started', render: (r) => <span className="whitespace-nowrap">{date(r.createdAt)}</span> },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      render: (r) =>
        can('donations.manage') && ['CREATED', 'ACTIVE'].includes(r.status) ? (
          <Button
            size="sm"
            variant="outline"
            className="text-red-700"
            loading={cancel.isPending && cancel.variables === r.id}
            onClick={async () => {
              const ok = await confirm({ title: 'Cancel monthly donation?', danger: true, confirmLabel: 'Cancel subscription', message: `${r.donor.name}'s ${money(r.amount, r.currency)}/month plan will be cancelled with the payment provider. No further charges will be made.` });
              if (ok) cancel.mutate(r.id);
            }}
          >
            Cancel
          </Button>
        ) : null,
    },
  ];

  return (
    <AdminPage title="Monthly giving" description="Recurring donation plans. Cancelling stops future charges with the payment provider.">
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Active plans" value={active.length} icon={Repeat} />
        <StatCard label="Monthly recurring" value={money(mrr)} hint="Sum of active plans" tone="green" />
        <StatCard label="All plans" value={data?.length ?? 0} />
      </div>
      <FilterBar>
        <SearchInput value={q} onChange={setQ} placeholder="Reference, donor, campaign…" />
        <AdminSelect label="Status" value={status} onChange={setStatus} options={[{ value: '', label: 'All statuses' }, ...STATUSES.map((s) => ({ value: s, label: titleCase(s) }))]} />
      </FilterBar>
      {error ? <QueryError error={error} retry={refetch} /> : <DataTable rows={rows} columns={columns} loading={isLoading} empty={<EmptyState icon={Repeat} title="No monthly donations" />} />}
      {data && data.length >= 200 && <p className="mt-2 text-xs text-ink-muted">Showing the 200 most recent plans.</p>}
    </AdminPage>
  );
}
