import { useState } from 'react';
import { Mail } from 'lucide-react';
import { qs, send } from '@/lib/api';
import { date } from '@/lib/format';
import { Button, EmptyState, StatusBadge, useConfirm } from '@/components/ui';
import { AdminPage, AdminSelect, DataTable, ExportButton, FilterBar, ListFooter, QueryError, SearchInput, useAdminList, type Column } from '../ui';
import { isoDay, useApiMutation } from './_common';

interface Subscriber {
  id: string;
  email: string;
  name: string;
  status: string;
  source: string;
  consentAt: string;
  unsubscribedAt: string | null;
  createdAt: string;
}

export default function SubscribersPage() {
  const confirm = useConfirm();
  const [status, setStatus] = useState('SUBSCRIBED');
  const [q, setQ] = useState('');
  const filters = { status, q: q.trim() || undefined };
  const { rows, meta, isLoading, error, refetch, setPage } = useAdminList<Subscriber>('/admin/subscribers', filters, 'subscribers');
  const unsub = useApiMutation((id: string) => send(`/admin/subscribers/${id}/unsubscribe`), { success: 'Subscriber unsubscribed', invalidate: [['admin', 'subscribers']] });

  const columns: Column<Subscriber>[] = [
    { key: 'email', header: 'Email', render: (s) => <span className="break-all font-medium">{s.email}</span> },
    { key: 'name', header: 'Name', render: (s) => s.name || <span className="text-ink-muted">—</span> },
    { key: 'source', header: 'Source', render: (s) => s.source || <span className="text-ink-muted">—</span> },
    { key: 'consent', header: 'Consent given', render: (s) => <span className="whitespace-nowrap">{date(s.consentAt)}</span> },
    { key: 'status', header: 'Status', render: (s) => <div><StatusBadge status={s.status} />{s.unsubscribedAt && <p className="mt-0.5 text-xs text-ink-muted">{date(s.unsubscribedAt)}</p>}</div> },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      render: (s) =>
        s.status === 'SUBSCRIBED' ? (
          <Button
            size="sm"
            variant="outline"
            loading={unsub.isPending && unsub.variables === s.id}
            onClick={async () => {
              if (await confirm({ title: 'Unsubscribe this address?', confirmLabel: 'Unsubscribe', danger: true, message: `${s.email} will no longer receive newsletters or campaign updates. Use this when someone asks by email or phone.` })) unsub.mutate(s.id);
            }}
          >
            Unsubscribe
          </Button>
        ) : null,
    },
  ];

  return (
    <AdminPage
      title="Newsletter subscribers"
      description="People who opted in to updates. Only subscribed addresses receive campaign announcements."
      actions={<ExportButton path={`/admin/subscribers${qs({ ...filters, format: 'csv' })}`} filename={`subscribers-${isoDay()}.csv`} />}
    >
      <FilterBar>
        <SearchInput value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Search email…" />
        <AdminSelect label="Status" value={status} onChange={(v) => { setStatus(v); setPage(1); }} options={[{ value: '', label: 'All' }, { value: 'SUBSCRIBED', label: 'Subscribed' }, { value: 'UNSUBSCRIBED', label: 'Unsubscribed' }]} />
      </FilterBar>
      {error ? (
        <QueryError error={error} retry={refetch} />
      ) : (
        <>
          <DataTable rows={rows} columns={columns} loading={isLoading} empty={<EmptyState icon={Mail} title="No subscribers found" />} />
          <ListFooter meta={meta} setPage={setPage} />
        </>
      )}
    </AdminPage>
  );
}
