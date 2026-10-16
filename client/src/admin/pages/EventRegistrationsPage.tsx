import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Ban, CalendarDays, CheckCircle2, ClipboardList, Hourglass, UserPlus, Users } from 'lucide-react';
import { api, send } from '@/lib/api';
import { dateTime } from '@/lib/format';
import { Badge, Button, Checkbox, EmptyState, Modal, StatusBadge, useConfirm } from '@/components/ui';
import { AdminPage, AdminSelect, DataTable, ExportButton, FilterBar, QueryError, SearchInput, StatCard, type Column } from '../ui';
import { AdminField, LoadingBlock, useApiMutation } from './_common';

interface Registration {
  id: string;
  reference: string;
  name: string;
  email: string;
  phone: string;
  type: 'ATTENDEE' | 'VOLUNTEER';
  guests: number;
  status: 'CONFIRMED' | 'WAITLISTED' | 'CANCELLED';
  attended: boolean;
  checkedInAt: string | null;
  createdAt: string;
}
interface Meta {
  event: { id: string; title: string; startsAt: string; status: string; slug: string };
  stats: { confirmed: number; waitlisted: number; volunteers: number; attended: number; capacity: number | null };
}

export default function EventRegistrationsPage() {
  const { id = '' } = useParams();
  const confirm = useConfirm();
  const key = ['admin', 'event-registrations', id];
  const { data, isLoading, error, refetch } = useQuery({ queryKey: key, queryFn: () => api<{ data: Registration[]; meta: Meta }>(`/admin/events/${id}/registrations`) });
  const [q, setQ] = useState('');
  const [type, setType] = useState('');
  const [status, setStatus] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelNote, setCancelNote] = useState('');

  const update = useApiMutation((r: Pick<Registration, 'id' | 'status' | 'attended'>) => send(`/admin/events/registrations/${r.id}`, { status: r.status, attended: r.attended }, 'PUT'), {
    success: 'Registration updated',
    invalidate: [key],
  });
  const cancelEvent = useApiMutation((note: string) => send<{ notified: number }>(`/admin/events/${id}/cancel`, { note, confirm: true }), {
    success: (r) => `Event cancelled. ${r.notified} ${r.notified === 1 ? 'person was' : 'people were'} notified.`,
    invalidate: [key, ['admin', 'dashboard']],
  });

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (data?.data ?? []).filter((r) => (!type || r.type === type) && (!status || r.status === status) && (!term || [r.name, r.email, r.reference, r.phone].some((s) => s.toLowerCase().includes(term))));
  }, [data, q, type, status]);

  const back = { href: id ? `/admin/content/events/${id}` : '/admin/content/events', label: 'Back to event' };
  if (error) return <AdminPage title="Registrations" back={back}><QueryError error={error} retry={refetch} /></AdminPage>;
  if (isLoading || !data) return <AdminPage title="Registrations" back={back}><LoadingBlock /></AdminPage>;
  const { event, stats } = data.meta;
  const cancelled = event.status === 'CANCELLED';

  const columns: Column<Registration>[] = [
    { key: 'name', header: 'Name', render: (r) => <div><p className="font-medium">{r.name}</p><p className="font-mono text-[11px] text-ink-muted">{r.reference}</p></div> },
    { key: 'contact', header: 'Contact', render: (r) => <div><a href={`mailto:${r.email}`} className="hover:text-primary">{r.email}</a>{r.phone && <p className="text-xs text-ink-muted">{r.phone}</p>}</div> },
    { key: 'type', header: 'Type', render: (r) => <Badge tone={r.type === 'VOLUNTEER' ? 'blue' : 'neutral'}>{r.type === 'VOLUNTEER' ? 'Volunteer' : 'Attendee'}</Badge> },
    { key: 'guests', header: 'Guests', className: 'text-right', render: (r) => <span className="block text-right">{r.guests || '—'}</span> },
    { key: 'registered', header: 'Registered', render: (r) => <span className="whitespace-nowrap text-xs">{dateTime(r.createdAt)}</span> },
    {
      key: 'status',
      header: 'Status',
      render: (r) => (
        <select
          aria-label={`Status for ${r.name}`}
          className="admin-input w-auto py-1 text-xs"
          value={r.status}
          disabled={update.isPending && update.variables?.id === r.id}
          onChange={async (e) => {
            const next = e.target.value as Registration['status'];
            if (next === 'CANCELLED' && !(await confirm({ title: 'Cancel registration?', danger: true, confirmLabel: 'Cancel registration', message: `${r.name}'s registration will be cancelled. They are not emailed automatically.` }))) return;
            update.mutate({ id: r.id, status: next, attended: r.attended });
          }}
        >
          <option value="CONFIRMED">Confirmed</option>
          <option value="WAITLISTED">Waitlisted</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
      ),
    },
    {
      key: 'attended',
      header: 'Attended',
      render: (r) => (
        <label className="flex cursor-pointer items-center gap-2 whitespace-nowrap text-xs">
          <input type="checkbox" className="h-5 w-5 accent-[rgb(var(--c-primary))]" checked={r.attended} disabled={update.isPending && update.variables?.id === r.id} onChange={(e) => update.mutate({ id: r.id, status: r.status, attended: e.target.checked })} />
          {r.attended ? <span className="text-emerald-700">{r.checkedInAt ? dateTime(r.checkedInAt) : 'Yes'}</span> : <span className="text-ink-muted">Check in</span>}
        </label>
      ),
    },
  ];

  return (
    <AdminPage
      title={`Registrations: ${event.title}`}
      description={<span className="flex flex-wrap items-center gap-2"><CalendarDays className="h-4 w-4" aria-hidden /> {dateTime(event.startsAt)} <StatusBadge status={event.status} /></span>}
      back={back}
      actions={
        <>
          <ExportButton path={`/admin/events/${id}/registrations?format=csv`} filename={`${event.slug}-registrations.csv`} />
          <Button size="sm" variant="outline" icon={UserPlus} onClick={() => setAddOpen(true)}>Add walk-in</Button>
          {!cancelled && (
            <Button
              size="sm"
              variant="danger"
              icon={Ban}
              loading={cancelEvent.isPending}
              onClick={() => setCancelOpen(true)}
            >
              Cancel event & notify
            </Button>
          )}
        </>
      }
    >
      {cancelled && <p className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-900">This event has been cancelled.</p>}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Confirmed attendees" value={stats.capacity ? `${stats.confirmed} / ${stats.capacity}` : stats.confirmed} hint={stats.capacity ? `${Math.max(0, stats.capacity - stats.confirmed)} places left · includes guests` : 'No capacity limit · includes guests'} icon={Users} tone={stats.capacity && stats.confirmed >= stats.capacity ? 'amber' : 'default'} />
        <StatCard label="Waitlisted" value={stats.waitlisted} icon={Hourglass} tone={stats.waitlisted ? 'amber' : 'default'} />
        <StatCard label="Volunteers" value={stats.volunteers} icon={ClipboardList} />
        <StatCard label="Attended" value={stats.attended} icon={CheckCircle2} tone="green" />
      </div>
      <FilterBar>
        <SearchInput value={q} onChange={setQ} placeholder="Name, email, phone, reference…" />
        <AdminSelect label="Type" value={type} onChange={setType} options={[{ value: '', label: 'All types' }, { value: 'ATTENDEE', label: 'Attendees' }, { value: 'VOLUNTEER', label: 'Volunteers' }]} />
        <AdminSelect label="Status" value={status} onChange={setStatus} options={[{ value: '', label: 'All statuses' }, { value: 'CONFIRMED', label: 'Confirmed' }, { value: 'WAITLISTED', label: 'Waitlisted' }, { value: 'CANCELLED', label: 'Cancelled' }]} />
        <p className="text-xs text-ink-muted sm:ml-auto">{rows.length} of {data.data.length} registrations</p>
      </FilterBar>
      <DataTable rows={rows} columns={columns} empty={<EmptyState icon={Users} title={data.data.length ? 'No registrations match' : 'No registrations yet'} />} />
      <p className="mt-3 text-xs text-ink-muted">Public event page: <Link className="text-primary hover:underline" to={`/events/${event.slug}`} target="_blank">/events/{event.slug}</Link></p>
      <Modal
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        title="Cancel event"
        size="sm"
        footer={
          <>
            <Button size="sm" variant="outline" onClick={() => setCancelOpen(false)}>Keep event</Button>
            <Button
              size="sm"
              variant="danger"
              loading={cancelEvent.isPending}
              onClick={async () => {
                const ok = await confirm({
                  title: 'Cancel event and notify everyone?',
                  danger: true,
                  confirmLabel: 'Cancel event',
                  message: `“${event.title}” will be marked as cancelled, registrations will close and every confirmed or waitlisted person will be emailed. This cannot be undone from here.`,
                });
                if (ok) cancelEvent.mutate(cancelNote.trim(), { onSuccess: () => setCancelOpen(false) });
              }}
            >
              Continue
            </Button>
          </>
        }
      >
        <AdminField label="Note for the cancellation email (optional)" help="e.g. the reason, or a new date if the event is being rescheduled.">
          <textarea className="admin-input min-h-[100px]" maxLength={400} value={cancelNote} onChange={(e) => setCancelNote(e.target.value)} />
        </AdminField>
      </Modal>
      <WalkInModal open={addOpen} onClose={() => setAddOpen(false)} eventId={id} invalidate={key} />
    </AdminPage>
  );
}

function WalkInModal({ open, onClose, eventId, invalidate }: { open: boolean; onClose: () => void; eventId: string; invalidate: unknown[] }) {
  const blank = { name: '', email: '', phone: '', type: 'ATTENDEE', attended: true };
  const [f, setF] = useState(blank);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const add = useApiMutation(() => send(`/admin/events/${eventId}/registrations`, f), {
    success: 'Registration added',
    invalidate: [invalidate],
    onFieldErrors: setErrors,
    onSuccess: () => {
      setF(blank);
      onClose();
    },
  });
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add walk-in registration"
      size="sm"
      footer={
        <>
          <Button size="sm" variant="outline" onClick={onClose}>Cancel</Button>
          <Button size="sm" type="submit" form="walkin-form" loading={add.isPending}>Add</Button>
        </>
      }
    >
      <form id="walkin-form" className="space-y-4" onSubmit={(e) => { e.preventDefault(); add.mutate(undefined); }}>
        <AdminField label="Name" required error={errors.name}><input className="admin-input" required minLength={2} maxLength={100} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></AdminField>
        <AdminField label="Email" required error={errors.email}><input type="email" className="admin-input" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></AdminField>
        <AdminField label="Phone" error={errors.phone}><input className="admin-input" maxLength={20} value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></AdminField>
        <AdminField label="Type" error={errors.type}>
          <select className="admin-input" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>
            <option value="ATTENDEE">Attendee</option>
            <option value="VOLUNTEER">Volunteer</option>
          </select>
        </AdminField>
        <Checkbox label="Mark as attended (checked in now)" checked={f.attended} onChange={(e) => setF({ ...f, attended: e.target.checked })} />
      </form>
    </Modal>
  );
}
