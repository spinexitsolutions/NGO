import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Mail, Phone, Trash2 } from 'lucide-react';
import { INQUIRY_TYPE_LABELS, type InquiryType } from '@ngo/shared';
import { get, send } from '@/lib/api';
import { dateTime } from '@/lib/format';
import { Badge, Button, StatusBadge, useConfirm } from '@/components/ui';
import { AdminPage, DetailList, QueryError } from '../ui';
import { AdminField, LoadingBlock, NotesPanel, Section, useApiMutation, type InternalNote } from './_common';

interface Inquiry {
  id: string;
  type: string;
  name: string;
  email: string;
  phone: string;
  organization: string;
  subject: string;
  message: string;
  status: 'NEW' | 'IN_PROGRESS' | 'RESOLVED' | 'SPAM';
  assignedToId: string | null;
  createdAt: string;
  updatedAt: string;
  notes: InternalNote[];
}

const STATUS_OPTIONS = [
  { value: 'NEW', label: 'New' },
  { value: 'IN_PROGRESS', label: 'In progress' },
  { value: 'RESOLVED', label: 'Resolved' },
  { value: 'SPAM', label: 'Spam' },
];

export default function InquiryDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const key = ['admin', 'inquiry', id];
  const { data: i, isLoading, error, refetch } = useQuery({ queryKey: key, queryFn: () => get<Inquiry>(`/admin/inquiries/${id}`) });
  const inv = [key, ['admin', 'inquiries'], ['admin', 'dashboard']];
  const setStatus = useApiMutation((status: string) => send(`/admin/inquiries/${id}`, { status, assignedToId: i?.assignedToId ?? null }, 'PUT'), { success: 'Status updated', invalidate: inv });
  const remove = useApiMutation(() => send(`/admin/inquiries/${id}`, { confirm: true }, 'DELETE'), {
    success: 'Inquiry deleted',
    invalidate: [['admin', 'inquiries'], ['admin', 'dashboard']],
    onSuccess: () => navigate('/admin/inquiries'),
  });

  const back = { href: '/admin/inquiries', label: 'Inquiries' };
  if (error) return <AdminPage title="Inquiry" back={back}><QueryError error={error} retry={refetch} /></AdminPage>;
  if (isLoading || !i) return <AdminPage title="Inquiry" back={back}><LoadingBlock /></AdminPage>;
  const reply = `mailto:${i.email}?subject=${encodeURIComponent(`Re: ${i.subject}`)}`;

  return (
    <AdminPage
      title={i.subject}
      description={<span className="flex flex-wrap items-center gap-2"><Badge>{INQUIRY_TYPE_LABELS[i.type as InquiryType] ?? i.type}</Badge> received {dateTime(i.createdAt)} <StatusBadge status={i.status} /></span>}
      back={back}
      actions={
        <>
          <a href={reply} className="btn btn-primary btn-sm"><Mail className="h-4 w-4" aria-hidden /> Reply by email</a>
          <Button
            size="sm"
            variant="outline"
            icon={Trash2}
            className="text-red-700"
            loading={remove.isPending}
            onClick={async () => {
              if (await confirm({ title: 'Delete inquiry?', danger: true, confirmLabel: 'Delete', message: 'The message and its notes will be permanently removed. Mark it as spam instead if you only want to hide it.' })) remove.mutate(undefined);
            }}
          >
            Delete
          </Button>
        </>
      }
    >
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Section title="Message">
            <p className="whitespace-pre-wrap text-sm leading-relaxed">{i.message}</p>
          </Section>
          <NotesPanel entityType="ContactInquiry" entityId={i.id} notes={i.notes} invalidate={key} />
        </div>
        <div className="space-y-6">
          <Section title="Contact">
            <DetailList
              items={[
                ['Name', i.name],
                ['Organisation', i.organization],
                ['Email', <a key="e" href={reply} className="inline-flex items-center gap-1 break-all text-primary hover:underline"><Mail className="h-3.5 w-3.5" aria-hidden />{i.email}</a>],
                ['Phone', i.phone && <a key="p" href={`tel:${i.phone}`} className="inline-flex items-center gap-1 text-primary hover:underline"><Phone className="h-3.5 w-3.5" aria-hidden />{i.phone}</a>],
              ]}
            />
          </Section>
          <Section title="Status">
            <AdminField label="Update status" help={`Last updated ${dateTime(i.updatedAt)}`}>
              <select className="admin-input" value={i.status} disabled={setStatus.isPending} onChange={(e) => setStatus.mutate(e.target.value)}>
                {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </AdminField>
            <div className="mt-3 flex flex-wrap gap-2">
              {i.status !== 'RESOLVED' && <Button size="sm" variant="outline" onClick={() => setStatus.mutate('RESOLVED')}>Mark resolved</Button>}
              {i.status !== 'SPAM' && <Button size="sm" variant="ghost" onClick={() => setStatus.mutate('SPAM')}>Mark as spam</Button>}
            </div>
          </Section>
        </div>
      </div>
    </AdminPage>
  );
}
