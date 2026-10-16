import { useState } from 'react';
import { Inbox } from 'lucide-react';
import { INQUIRY_TYPES, INQUIRY_TYPE_LABELS, type InquiryType } from '@ngo/shared';
import { date } from '@/lib/format';
import { Badge, EmptyState, StatusBadge, Tabs } from '@/components/ui';
import { AdminPage, AdminSelect, DataTable, FilterBar, ListFooter, QueryError, SearchInput, useAdminList, type Column } from '../ui';

export interface InquiryRow {
  id: string;
  type: string;
  name: string;
  email: string;
  phone: string;
  organization: string;
  subject: string;
  message: string;
  status: string;
  createdAt: string;
}

const STATUSES = ['NEW', 'IN_PROGRESS', 'RESOLVED', 'SPAM'] as const;
type Tab = '' | (typeof STATUSES)[number];
const STATUS_LABEL: Record<string, string> = { NEW: 'New', IN_PROGRESS: 'In progress', RESOLVED: 'Resolved', SPAM: 'Spam' };
export const inquiryTypeLabel = (t: string) => INQUIRY_TYPE_LABELS[t as InquiryType] ?? t;

export default function InquiriesPage() {
  const [status, setStatus] = useState<Tab>('NEW');
  const [type, setType] = useState('');
  const [q, setQ] = useState('');
  const { rows, meta, isLoading, error, refetch, setPage } = useAdminList<InquiryRow>('/admin/inquiries', { status, type, q: q.trim() || undefined }, 'inquiries');
  const counts = (meta?.counts as Record<string, number> | undefined) ?? {};
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  const tabs = [...STATUSES.map((s) => ({ value: s as Tab, label: <>{STATUS_LABEL[s]} <Count n={counts[s] ?? 0} /></> })), { value: '' as Tab, label: <>All <Count n={total} /></> }];

  const columns: Column<InquiryRow>[] = [
    { key: 'subject', header: 'Subject', render: (i) => <span className={i.status === 'NEW' ? 'font-semibold' : ''}>{i.subject}</span> },
    { key: 'from', header: 'From', render: (i) => <div><p>{i.name}</p><p className="text-xs text-ink-muted">{i.email}{i.organization && ` · ${i.organization}`}</p></div> },
    { key: 'type', header: 'Type', render: (i) => <Badge>{inquiryTypeLabel(i.type)}</Badge> },
    { key: 'date', header: 'Received', render: (i) => <span className="whitespace-nowrap">{date(i.createdAt)}</span> },
    { key: 'status', header: 'Status', render: (i) => <StatusBadge status={i.status} /> },
  ];

  return (
    <AdminPage title="Inquiries" description="Messages from the website contact and partnership forms.">
      <Tabs className="mb-4" tabs={tabs} value={status} onChange={(v) => { setStatus(v); setPage(1); }} />
      <FilterBar>
        <SearchInput value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Name, email, subject, organisation…" />
        <AdminSelect label="Type" value={type} onChange={(v) => { setType(v); setPage(1); }} options={[{ value: '', label: 'All types' }, ...INQUIRY_TYPES.map((t) => ({ value: t, label: INQUIRY_TYPE_LABELS[t] }))]} />
      </FilterBar>
      {error ? (
        <QueryError error={error} retry={refetch} />
      ) : (
        <>
          <DataTable rows={rows} columns={columns} loading={isLoading} rowHref={(i) => `/admin/inquiries/${i.id}`} empty={<EmptyState icon={Inbox} title={status === 'NEW' ? 'Inbox zero — no new inquiries' : 'No inquiries here'} />} />
          <ListFooter meta={meta} setPage={setPage} />
        </>
      )}
    </AdminPage>
  );
}

function Count({ n }: { n: number }) {
  return <span className="ml-1 rounded-full bg-ink/[0.07] px-1.5 py-0.5 text-[11px] font-semibold text-ink-muted">{n}</span>;
}
