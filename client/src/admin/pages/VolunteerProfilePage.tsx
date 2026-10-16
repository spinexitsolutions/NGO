import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Clock, Download, Pencil, Plus, Trash2 } from 'lucide-react';
import { download, get, send } from '@/lib/api';
import { date, titleCase } from '@/lib/format';
import { useAuth } from '@/app/AuthProvider';
import { Button, Modal, StatusBadge, useConfirm, useToast } from '@/components/ui';
import { AdminPage, DetailList, QueryError, StatCard } from '../ui';
import { AdminField, Chips, LoadingBlock, Section, errorMessage, isoDay, useApiMutation, useOptions } from './_common';

interface Assignment {
  id: string;
  role: string;
  responsibilities: string;
  projectId: string | null;
  eventId: string | null;
  opportunityId: string | null;
  startDate: string;
  endDate: string | null;
  status: string;
  project: { title: string } | null;
  event: { title: string } | null;
  opportunity: { title: string } | null;
}
interface HoursRow { id: string; date: string; minutes: number; activity: string; assignmentId: string | null }
interface Profile {
  id: string;
  name: string;
  email: string;
  phone: string;
  city: string;
  dateOfBirth: string | null;
  occupation: string;
  interests: string[];
  skills: string[];
  experience: string;
  availability: string;
  hoursPerWeek: number | null;
  preferredLocation: string;
  emergencyContact: string;
  roleTitle: string;
  status: string;
  hasResume: boolean;
  createdAt: string;
  applications: { id: string; reference: string; status: string; createdAt: string; opportunity: { title: string } | null }[];
  assignments: Assignment[];
  hours: HoursRow[];
}

export default function VolunteerProfilePage() {
  const { id = '' } = useParams();
  const { can } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const key = ['admin', 'volunteer', id];
  const { data: p, isLoading, error, refetch } = useQuery({ queryKey: key, queryFn: () => get<Profile>(`/admin/volunteers/profiles/${id}`) });
  const manage = can('volunteers.manage');
  const [editing, setEditing] = useState<Assignment | 'new' | null>(null);
  const [hoursOpen, setHoursOpen] = useState(false);
  const [meta, setMeta] = useState({ status: 'APPLICANT', roleTitle: '' });
  useEffect(() => {
    if (p) setMeta({ status: p.status, roleTitle: p.roleTitle });
  }, [p]);

  const inv = [key, ['admin', 'volunteers']];
  const saveMeta = useApiMutation(() => send(`/admin/volunteers/profiles/${id}`, meta, 'PUT'), { success: 'Volunteer updated', invalidate: inv });
  const delHours = useApiMutation((hid: string) => send(`/admin/volunteers/hours/${hid}`, { confirm: true }, 'DELETE'), { success: 'Hours entry deleted', invalidate: inv });

  if (error) return <AdminPage title="Volunteer" back={{ href: '/admin/volunteers', label: 'Volunteers' }}><QueryError error={error} retry={refetch} /></AdminPage>;
  if (isLoading || !p) return <AdminPage title="Volunteer" back={{ href: '/admin/volunteers', label: 'Volunteers' }}><LoadingBlock /></AdminPage>;

  const totalHours = Math.round(p.hours.reduce((n, h) => n + h.minutes, 0) / 6) / 10;

  return (
    <AdminPage
      title={<span className="flex flex-wrap items-center gap-3">{p.name} <StatusBadge status={p.status} /></span>}
      description={`${p.roleTitle ? `${p.roleTitle} · ` : ''}${p.city} · volunteer since ${date(p.createdAt)}`}
      back={{ href: '/admin/volunteers', label: 'Volunteers' }}
      actions={
        <>
          {p.hasResume && (
            <Button size="sm" variant="outline" icon={Download} onClick={() => download(`/admin/volunteers/profiles/${p.id}/resume`, `resume-${p.name.replace(/\s+/g, '-').toLowerCase()}.pdf`).catch((e) => toast(errorMessage(e, 'Download failed'), 'error'))}>
              Résumé
            </Button>
          )}
          {manage && <Button size="sm" variant="outline" icon={Clock} onClick={() => setHoursOpen(true)}>Record hours</Button>}
          {manage && <Button size="sm" icon={Plus} disabled={p.status !== 'ACTIVE'} title={p.status !== 'ACTIVE' ? 'Only active volunteers can be assigned' : undefined} onClick={() => setEditing('new')}>New assignment</Button>}
        </>
      }
    >
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Hours logged" value={totalHours} icon={Clock} hint={p.hours.length >= 100 ? 'Latest 100 entries' : undefined} />
        <StatCard label="Active assignments" value={p.assignments.filter((a) => a.status === 'ACTIVE').length} />
        <StatCard label="Applications" value={p.applications.length} />
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Section title="Assignments">
            {p.assignments.length === 0 ? (
              <p className="text-sm text-ink-muted">{p.status === 'ACTIVE' ? 'No assignments yet.' : 'Approve the volunteer’s application to start assigning work.'}</p>
            ) : (
              <ul className="divide-y divide-line">
                {p.assignments.map((a) => (
                  <li key={a.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="font-medium">{a.role} <StatusBadge status={a.status} /></p>
                      <p className="text-xs text-ink-muted">
                        {[a.project && `Project: ${a.project.title}`, a.event && `Event: ${a.event.title}`, a.opportunity && `Opportunity: ${a.opportunity.title}`].filter(Boolean).join(' · ') || 'General'}
                        {' · '}
                        {date(a.startDate)}{a.endDate ? ` – ${date(a.endDate)}` : ' onwards'}
                      </p>
                      {a.responsibilities && <p className="mt-1 whitespace-pre-wrap text-sm text-ink-muted">{a.responsibilities}</p>}
                    </div>
                    {manage && <Button size="sm" variant="outline" icon={Pencil} onClick={() => setEditing(a)}>Edit</Button>}
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="Hours log" actions={manage ? <Button size="sm" variant="outline" icon={Plus} onClick={() => setHoursOpen(true)}>Record hours</Button> : undefined}>
            {p.hours.length === 0 ? (
              <p className="text-sm text-ink-muted">No hours recorded yet.</p>
            ) : (
              <div className="-mx-5 overflow-x-auto">
                <table className="table-base">
                  <thead><tr><th>Date</th><th>Activity</th><th>Assignment</th><th className="text-right">Hours</th>{manage && <th><span className="sr-only">Actions</span></th>}</tr></thead>
                  <tbody>
                    {p.hours.map((h) => (
                      <tr key={h.id}>
                        <td className="whitespace-nowrap">{date(h.date)}</td>
                        <td>{h.activity}</td>
                        <td className="text-ink-muted">{p.assignments.find((a) => a.id === h.assignmentId)?.role ?? '—'}</td>
                        <td className="text-right font-semibold">{Math.round(h.minutes / 6) / 10}</td>
                        {manage && (
                          <td className="text-right">
                            <button
                              className="rounded p-1.5 text-ink-muted hover:bg-red-50 hover:text-red-700"
                              aria-label={`Delete hours entry ${h.activity}`}
                              onClick={async () => {
                                if (await confirm({ title: 'Delete hours entry?', danger: true, confirmLabel: 'Delete', message: `${Math.round(h.minutes / 6) / 10} hours on ${date(h.date)} (“${h.activity}”) will be removed.` })) delHours.mutate(h.id);
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>

          <Section title="Profile">
            <DetailList
              items={[
                ['Email', <a key="e" href={`mailto:${p.email}`} className="text-primary hover:underline">{p.email}</a>],
                ['Phone', p.phone && <a key="p" href={`tel:${p.phone}`} className="hover:underline">{p.phone}</a>],
                ['Occupation', p.occupation],
                ['Date of birth', date(p.dateOfBirth)],
                ['Availability', p.availability],
                ['Hours per week', p.hoursPerWeek ? String(p.hoursPerWeek) : ''],
                ['Preferred location', p.preferredLocation],
                ['Emergency contact', p.emergencyContact],
                ['Interests', <Chips key="i" items={p.interests} />],
                ['Skills', <Chips key="s" items={p.skills} />],
              ]}
            />
            {p.experience && <div className="mt-4"><p className="admin-label">Experience</p><p className="whitespace-pre-wrap text-sm">{p.experience}</p></div>}
          </Section>
        </div>

        <div className="space-y-6">
          {manage && (
            <Section title="Status & role">
              <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); saveMeta.mutate(undefined); }}>
                <AdminField label="Status">
                  <select className="admin-input" value={meta.status} onChange={(e) => setMeta({ ...meta, status: e.target.value })}>
                    {['APPLICANT', 'ACTIVE', 'INACTIVE'].map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}
                  </select>
                </AdminField>
                <AdminField label="Role title" help="e.g. Weekend tutor, Event lead">
                  <input className="admin-input" maxLength={80} value={meta.roleTitle} onChange={(e) => setMeta({ ...meta, roleTitle: e.target.value })} />
                </AdminField>
                <Button size="sm" type="submit" loading={saveMeta.isPending}>Save</Button>
              </form>
            </Section>
          )}
          <Section title="Applications">
            {p.applications.length === 0 ? (
              <p className="text-sm text-ink-muted">None.</p>
            ) : (
              <ul className="space-y-2">
                {p.applications.map((a) => (
                  <li key={a.id} className="text-sm">
                    <Link to={`/admin/volunteers/applications/${a.id}`} className="font-mono text-xs text-primary hover:underline">{a.reference}</Link> <StatusBadge status={a.status} />
                    <p className="text-xs text-ink-muted">{a.opportunity?.title ?? 'General'} · {date(a.createdAt)}</p>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>
      </div>

      <AssignmentModal value={editing} profileId={p.id} onClose={() => setEditing(null)} invalidate={inv} />
      <HoursModal open={hoursOpen} profileId={p.id} assignments={p.assignments} onClose={() => setHoursOpen(false)} invalidate={inv} />
    </AdminPage>
  );
}

const blankAssignment = { role: '', responsibilities: '', projectId: '', eventId: '', opportunityId: '', startDate: isoDay(), endDate: '', status: 'ACTIVE' };

function AssignmentModal({ value, profileId, onClose, invalidate }: { value: Assignment | 'new' | null; profileId: string; onClose: () => void; invalidate: unknown[][] }) {
  const open = value !== null;
  const [f, setF] = useState(blankAssignment);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const projects = useOptions('projects', open);
  const events = useOptions('events', open);
  const opps = useOptions('opportunities', open);
  useEffect(() => {
    setErrors({});
    if (value && value !== 'new')
      setF({ role: value.role, responsibilities: value.responsibilities, projectId: value.projectId ?? '', eventId: value.eventId ?? '', opportunityId: value.opportunityId ?? '', startDate: value.startDate.slice(0, 10), endDate: value.endDate?.slice(0, 10) ?? '', status: value.status });
    else setF(blankAssignment);
  }, [value]);
  const isNew = value === 'new';
  const save = useApiMutation(
    () => {
      const body = { ...f, profileId, projectId: f.projectId || null, eventId: f.eventId || null, opportunityId: f.opportunityId || null, endDate: f.endDate || null };
      return isNew ? send('/admin/volunteers/assignments', body) : send(`/admin/volunteers/assignments/${(value as Assignment).id}`, body, 'PUT');
    },
    { success: isNew ? 'Assignment created' : 'Assignment updated', invalidate, onFieldErrors: setErrors, onSuccess: onClose },
  );
  const upd = (k: keyof typeof blankAssignment) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }));
  const select = (k: 'projectId' | 'eventId' | 'opportunityId', label: string, opts: { id: string; label: string }[] | undefined) => (
    <AdminField label={label} error={errors[k]}>
      <select className="admin-input" value={f[k]} onChange={upd(k)}>
        <option value="">— None —</option>
        {(opts ?? []).map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
      </select>
    </AdminField>
  );
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isNew ? 'New assignment' : 'Edit assignment'}
      size="lg"
      footer={
        <>
          <Button size="sm" variant="outline" onClick={onClose}>Cancel</Button>
          <Button size="sm" type="submit" form="assignment-form" loading={save.isPending}>{isNew ? 'Create' : 'Save'}</Button>
        </>
      }
    >
      <form id="assignment-form" className="grid gap-4 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); save.mutate(undefined); }}>
        <AdminField label="Role" required error={errors.role} className="sm:col-span-2"><input className="admin-input" required minLength={2} maxLength={120} value={f.role} onChange={upd('role')} /></AdminField>
        <AdminField label="Responsibilities" error={errors.responsibilities} className="sm:col-span-2"><textarea className="admin-input min-h-[80px]" maxLength={1000} value={f.responsibilities} onChange={upd('responsibilities')} /></AdminField>
        {select('projectId', 'Project', projects.data)}
        {select('eventId', 'Event', events.data)}
        {select('opportunityId', 'Opportunity', opps.data)}
        <AdminField label="Status" error={errors.status}>
          <select className="admin-input" value={f.status} onChange={upd('status')}>{['ACTIVE', 'COMPLETED', 'CANCELLED'].map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}</select>
        </AdminField>
        <AdminField label="Start date" required error={errors.startDate}><input type="date" className="admin-input" required value={f.startDate} onChange={upd('startDate')} /></AdminField>
        <AdminField label="End date" error={errors.endDate}><input type="date" className="admin-input" min={f.startDate} value={f.endDate} onChange={upd('endDate')} /></AdminField>
      </form>
    </Modal>
  );
}

function HoursModal({ open, profileId, assignments, onClose, invalidate }: { open: boolean; profileId: string; assignments: Assignment[]; onClose: () => void; invalidate: unknown[][] }) {
  const blank = { date: isoDay(), hours: '', activity: '', assignmentId: '' };
  const [f, setF] = useState(blank);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const save = useApiMutation(() => send('/admin/volunteers/hours', { profileId, date: f.date, hours: Number(f.hours), activity: f.activity, assignmentId: f.assignmentId || null }), {
    success: 'Hours recorded',
    invalidate,
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
      title="Record volunteer hours"
      size="sm"
      footer={
        <>
          <Button size="sm" variant="outline" onClick={onClose}>Cancel</Button>
          <Button size="sm" type="submit" form="hours-form" loading={save.isPending}>Record</Button>
        </>
      }
    >
      <form id="hours-form" className="space-y-4" onSubmit={(e) => { e.preventDefault(); save.mutate(undefined); }}>
        <div className="grid grid-cols-2 gap-3">
          <AdminField label="Date" required error={errors.date}><input type="date" className="admin-input" required max={isoDay()} value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></AdminField>
          <AdminField label="Hours" required error={errors.hours}><input type="number" className="admin-input" required min="0.25" max="24" step="0.25" value={f.hours} onChange={(e) => setF({ ...f, hours: e.target.value })} /></AdminField>
        </div>
        <AdminField label="Activity" required error={errors.activity}><input className="admin-input" required minLength={2} maxLength={200} value={f.activity} onChange={(e) => setF({ ...f, activity: e.target.value })} placeholder="e.g. Tutoring session at community centre" /></AdminField>
        {assignments.length > 0 && (
          <AdminField label="Assignment" error={errors.assignmentId}>
            <select className="admin-input" value={f.assignmentId} onChange={(e) => setF({ ...f, assignmentId: e.target.value })}>
              <option value="">— None —</option>
              {assignments.map((a) => <option key={a.id} value={a.id}>{a.role}</option>)}
            </select>
          </AdminField>
        )}
      </form>
    </Modal>
  );
}
