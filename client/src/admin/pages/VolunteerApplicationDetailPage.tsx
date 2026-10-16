import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, Download, Eye, HelpCircle, XCircle } from 'lucide-react';
import { download, get, send } from '@/lib/api';
import { date, dateTime } from '@/lib/format';
import { useAuth } from '@/app/AuthProvider';
import { Button, Checkbox, Modal, StatusBadge, useToast } from '@/components/ui';
import { AdminPage, DetailList, QueryError } from '../ui';
import { AdminField, Chips, LoadingBlock, NotesPanel, Section, errorMessage, useApiMutation, type InternalNote } from './_common';

interface ApplicationDetail {
  id: string;
  reference: string;
  status: string;
  motivation: string;
  messageToApplicant: string;
  reviewedAt: string | null;
  createdAt: string;
  opportunity: { id: string; title: string; location: string; commitment: string } | null;
  profile: {
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
    status: string;
    hasResume: boolean;
    applications: { id: string; reference: string; status: string; createdAt: string }[];
    assignments: { id: string; role: string; status: string; startDate: string }[];
  };
  notes: InternalNote[];
}

type Action = 'UNDER_REVIEW' | 'INFO_REQUESTED' | 'APPROVED' | 'REJECTED';
const ACTION_TEXT: Record<Action, { title: string; button: string; help: string }> = {
  UNDER_REVIEW: { title: 'Mark as under review', button: 'Mark under review', help: 'Applicants are not emailed for this step.' },
  INFO_REQUESTED: { title: 'Request more information', button: 'Send request', help: 'Tell the applicant exactly what you need. This message appears on their status page.' },
  APPROVED: { title: 'Approve applicant', button: 'Approve', help: 'The volunteer profile becomes active and can be given assignments.' },
  REJECTED: { title: 'Decline application', button: 'Decline', help: 'Be kind — the applicant sees “Not selected this time” and your message.' },
};

export default function VolunteerApplicationDetailPage() {
  const { id = '' } = useParams();
  const { can } = useAuth();
  const toast = useToast();
  const key = ['admin', 'volunteer-application', id];
  const { data: a, isLoading, error, refetch } = useQuery({ queryKey: key, queryFn: () => get<ApplicationDetail>(`/admin/volunteers/applications/${id}`) });
  const [action, setAction] = useState<Action | null>(null);
  const manage = can('volunteers.manage');

  if (error) return <AdminPage title="Application" back={{ href: '/admin/volunteers/applications', label: 'Applications' }}><QueryError error={error} retry={refetch} /></AdminPage>;
  if (isLoading || !a) return <AdminPage title="Application" back={{ href: '/admin/volunteers/applications', label: 'Applications' }}><LoadingBlock /></AdminPage>;
  const p = a.profile;
  const closed = ['APPROVED', 'REJECTED', 'WITHDRAWN'].includes(a.status);

  return (
    <AdminPage
      title={<span className="flex flex-wrap items-center gap-3">{p.name} <StatusBadge status={a.status} /></span>}
      description={<>Application <span className="font-mono">{a.reference}</span> · submitted {dateTime(a.createdAt)}{a.reviewedAt && ` · last reviewed ${dateTime(a.reviewedAt)}`}</>}
      back={{ href: '/admin/volunteers/applications', label: 'Applications' }}
      actions={
        manage && a.status !== 'WITHDRAWN' ? (
          <>
            {a.status === 'SUBMITTED' && <Button size="sm" variant="outline" icon={Eye} onClick={() => setAction('UNDER_REVIEW')}>Under review</Button>}
            {!closed && <Button size="sm" variant="outline" icon={HelpCircle} onClick={() => setAction('INFO_REQUESTED')}>Request info</Button>}
            {a.status !== 'REJECTED' && <Button size="sm" variant="outline" icon={XCircle} className="text-red-700" onClick={() => setAction('REJECTED')}>Reject</Button>}
            {a.status !== 'APPROVED' && <Button size="sm" icon={CheckCircle2} onClick={() => setAction('APPROVED')}>Approve</Button>}
          </>
        ) : undefined
      }
    >
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {a.messageToApplicant && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <p className="font-semibold">Last message to applicant</p>
              <p className="whitespace-pre-wrap">{a.messageToApplicant}</p>
            </div>
          )}
          <Section title="Motivation">
            <p className="whitespace-pre-wrap text-sm">{a.motivation || <span className="text-ink-muted">Not provided</span>}</p>
          </Section>
          <Section title="Skills & experience">
            <DetailList
              items={[
                ['Interests', <Chips key="i" items={p.interests} />],
                ['Skills', <Chips key="s" items={p.skills} />],
                ['Availability', p.availability],
                ['Hours per week', p.hoursPerWeek ? String(p.hoursPerWeek) : ''],
                ['Preferred location', p.preferredLocation],
                ['Occupation', p.occupation],
              ]}
            />
            {p.experience && (
              <div className="mt-4">
                <p className="admin-label">Experience</p>
                <p className="whitespace-pre-wrap text-sm">{p.experience}</p>
              </div>
            )}
          </Section>
          <Section title="Opportunity">
            {a.opportunity ? (
              <DetailList items={[['Title', a.opportunity.title], ['Location', a.opportunity.location], ['Commitment', a.opportunity.commitment]]} />
            ) : (
              <p className="text-sm text-ink-muted">General application (no specific opportunity).</p>
            )}
          </Section>
        </div>
        <div className="space-y-6">
          <Section title="Applicant" actions={<Link to={`/admin/volunteers/${p.id}`} className="text-sm text-primary hover:underline">Profile</Link>}>
            <div className="space-y-1 text-sm">
              <p><a href={`mailto:${p.email}`} className="break-all text-primary hover:underline">{p.email}</a></p>
              {p.phone && <p><a href={`tel:${p.phone}`} className="hover:underline">{p.phone}</a></p>}
              <p className="text-ink-muted">{p.city}</p>
              {p.dateOfBirth && <p className="text-ink-muted">Born {date(p.dateOfBirth)}</p>}
              {p.emergencyContact && <p className="text-xs text-ink-muted">Emergency contact: {p.emergencyContact}</p>}
              <p className="pt-1">Profile status: <StatusBadge status={p.status} /></p>
            </div>
            {p.hasResume && (
              <Button
                size="sm"
                variant="outline"
                icon={Download}
                className="mt-4"
                onClick={() => download(`/admin/volunteers/profiles/${p.id}/resume`, `resume-${p.name.replace(/\s+/g, '-').toLowerCase()}.pdf`).catch((e) => toast(errorMessage(e, 'Download failed'), 'error'))}
              >
                Download résumé
              </Button>
            )}
            {p.applications.length > 1 && (
              <div className="mt-4">
                <p className="admin-label">Other applications</p>
                <ul className="space-y-1 text-sm">
                  {p.applications.filter((x) => x.id !== a.id).map((x) => (
                    <li key={x.id}><Link to={`/admin/volunteers/applications/${x.id}`} className="font-mono text-xs text-primary hover:underline">{x.reference}</Link> <StatusBadge status={x.status} /></li>
                  ))}
                </ul>
              </div>
            )}
          </Section>
          <NotesPanel entityType="VolunteerApplication" entityId={a.id} notes={a.notes} invalidate={key} />
        </div>
      </div>
      <StatusModal action={action} onClose={() => setAction(null)} applicationId={a.id} name={p.name} invalidate={key} />
    </AdminPage>
  );
}

function StatusModal({ action, onClose, applicationId, name, invalidate }: { action: Action | null; onClose: () => void; applicationId: string; name: string; invalidate: unknown[] }) {
  const [message, setMessage] = useState('');
  const [notify, setNotify] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const save = useApiMutation((status: Action) => send(`/admin/volunteers/applications/${applicationId}/status`, { status, message: message.trim(), notify: status === 'UNDER_REVIEW' ? false : notify }), {
    success: (_r, s) => `Application ${s === 'APPROVED' ? 'approved' : s === 'REJECTED' ? 'declined' : s === 'INFO_REQUESTED' ? 'updated — information requested' : 'marked under review'}`,
    invalidate: [invalidate, ['admin', 'volunteer-applications'], ['admin', 'dashboard']],
    onFieldErrors: setErrors,
    onSuccess: () => {
      setMessage('');
      onClose();
    },
  });
  if (!action) return <Modal open={false} onClose={onClose} title="">{null}</Modal>;
  const t = ACTION_TEXT[action];
  const needsMessage = action === 'INFO_REQUESTED';
  return (
    <Modal
      open
      onClose={onClose}
      title={t.title}
      footer={
        <>
          <Button size="sm" variant="outline" onClick={onClose}>Cancel</Button>
          <Button size="sm" variant={action === 'REJECTED' ? 'danger' : 'primary'} loading={save.isPending} disabled={needsMessage && !message.trim()} onClick={() => save.mutate(action)}>{t.button}</Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-ink-muted">{t.help}</p>
        {action !== 'UNDER_REVIEW' && (
          <>
            <AdminField label={needsMessage ? 'Message to applicant' : 'Message to applicant (optional)'} required={needsMessage} error={errors.message}>
              <textarea className="admin-input min-h-[110px]" maxLength={1000} value={message} onChange={(e) => setMessage(e.target.value)} placeholder={needsMessage ? 'e.g. Could you share your weekend availability for March?' : ''} />
            </AdminField>
            <Checkbox label={`Email ${name} about this update`} checked={notify} onChange={(e) => setNotify(e.target.checked)} />
          </>
        )}
      </div>
    </Modal>
  );
}
