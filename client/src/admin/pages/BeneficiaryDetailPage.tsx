import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Baby, CalendarClock, Package, Plus } from 'lucide-react';
import { toMinor } from '@ngo/shared';
import { get, send } from '@/lib/api';
import { date, dateTime, money } from '@/lib/format';
import { useAuth } from '@/app/AuthProvider';
import { Badge, Button, Modal, StatusBadge } from '@/components/ui';
import { AdminPage, QueryError } from '../ui';
import { AdminField, Chips, LoadingBlock, Section, isoDay, useApiMutation, useOptions } from './_common';
import { BeneficiaryForm, PrivacyNotice, beneficiaryPayload, blankBeneficiary, type BeneficiaryFormValue } from './_beneficiary';

interface Assistance { id: string; type: string; description: string; quantity: number; unit: string; valueAmount: number | null; distributedAt: string; projectId: string | null }
interface CaseNote { id: string; note: string; followUpAt: string | null; createdAt: string }
interface Beneficiary {
  id: string;
  code: string;
  fullName: string;
  gender: string;
  dateOfBirth: string | null;
  isMinor: boolean;
  guardianName: string;
  phone: string;
  address: string;
  village: string;
  district: string;
  projectId: string | null;
  project: { id: string; title: string } | null;
  programs: string[];
  status: string;
  consentPublic: boolean;
  createdAt: string;
  updatedAt: string;
  assistance: Assistance[];
  caseNotes: CaseNote[];
}

export default function BeneficiaryDetailPage() {
  const { id = '' } = useParams();
  const { can } = useAuth();
  const manage = can('beneficiaries.manage');
  const key = ['admin', 'beneficiary', id];
  const { data: b, isLoading, error, refetch } = useQuery({ queryKey: key, queryFn: () => get<Beneficiary>(`/admin/beneficiaries/${id}`), staleTime: 60_000 });
  const [f, setF] = useState<BeneficiaryFormValue>(blankBeneficiary);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [assistOpen, setAssistOpen] = useState(false);
  const [note, setNote] = useState({ note: '', followUpAt: '' });
  const projects = useOptions('projects');

  useEffect(() => {
    if (b)
      setF({
        fullName: b.fullName,
        gender: b.gender,
        dateOfBirth: b.dateOfBirth?.slice(0, 10) ?? '',
        guardianName: b.guardianName,
        phone: b.phone,
        address: b.address,
        village: b.village,
        district: b.district,
        projectId: b.projectId ?? '',
        programs: b.programs.join(', '),
        status: b.status,
        consentPublic: b.consentPublic,
      });
  }, [b]);

  const inv = [key, ['admin', 'beneficiaries'], ['admin', 'beneficiaries-summary']];
  const save = useApiMutation(() => send(`/admin/beneficiaries/${id}`, beneficiaryPayload(f), 'PUT'), { success: 'Record updated', invalidate: inv, onFieldErrors: setErrors });
  const addNote = useApiMutation(() => send(`/admin/beneficiaries/${id}/notes`, { note: note.note.trim(), followUpAt: note.followUpAt || null }), {
    success: 'Case note added',
    invalidate: [key],
    onSuccess: () => setNote({ note: '', followUpAt: '' }),
  });

  const back = { href: '/admin/beneficiaries', label: 'Beneficiaries' };
  if (error) return <AdminPage title="Beneficiary" back={back}><QueryError error={error} retry={refetch} /></AdminPage>;
  if (isLoading || !b) return <AdminPage title="Beneficiary" back={back}><LoadingBlock /></AdminPage>;
  const projectName = (pid: string | null) => (pid ? projects.data?.find((p) => p.id === pid)?.label : undefined);

  return (
    <AdminPage
      title={<span className="flex flex-wrap items-center gap-3">{b.fullName} <StatusBadge status={b.status} />{b.isMinor && <Badge tone="amber"><Baby className="h-3 w-3" aria-hidden /> Minor</Badge>}</span>}
      description={<><span className="font-mono">{b.code}</span> · added {date(b.createdAt)} · last updated {dateTime(b.updatedAt)}</>}
      back={back}
      actions={manage ? <Button size="sm" icon={Plus} onClick={() => setAssistOpen(true)}>Record assistance</Button> : undefined}
    >
      <PrivacyNotice />
      {b.isMinor && (
        <p className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          This person is a <strong>minor</strong>. Never publish their name, photo or location; any story requires guardian consent{b.guardianName ? ` (guardian: ${b.guardianName})` : ''}.
        </p>
      )}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Section title="Profile">
            <form onSubmit={(e) => { e.preventDefault(); save.mutate(undefined); }}>
              <BeneficiaryForm value={f} onChange={setF} errors={errors} disabled={!manage} />
              {manage && <div className="mt-4 flex justify-end"><Button size="sm" type="submit" loading={save.isPending}>Save changes</Button></div>}
            </form>
          </Section>

          <Section title="Assistance received" actions={manage ? <Button size="sm" variant="outline" icon={Plus} onClick={() => setAssistOpen(true)}>Add</Button> : undefined}>
            {b.assistance.length === 0 ? (
              <p className="flex items-center gap-2 text-sm text-ink-muted"><Package className="h-4 w-4" aria-hidden /> No assistance recorded yet.</p>
            ) : (
              <div className="-mx-5 overflow-x-auto">
                <table className="table-base">
                  <thead><tr><th>Date</th><th>Type</th><th className="text-right">Quantity</th><th className="text-right">Value</th><th>Project</th></tr></thead>
                  <tbody>
                    {b.assistance.map((a) => (
                      <tr key={a.id}>
                        <td className="whitespace-nowrap">{date(a.distributedAt)}</td>
                        <td><p className="font-medium">{a.type}</p>{a.description && <p className="text-xs text-ink-muted">{a.description}</p>}</td>
                        <td className="whitespace-nowrap text-right">{a.quantity.toLocaleString('en-IN')} {a.unit}</td>
                        <td className="whitespace-nowrap text-right">{a.valueAmount != null ? money(a.valueAmount) : '—'}</td>
                        <td>{projectName(a.projectId) ?? <span className="text-ink-muted">—</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>
        </div>

        <div className="space-y-6">
          <Section title="Summary">
            <dl className="space-y-2 text-sm">
              <div><dt className="admin-label">Project</dt><dd>{b.project?.title ?? '—'}</dd></div>
              <div><dt className="admin-label">Programmes</dt><dd><Chips items={b.programs} /></dd></div>
              <div><dt className="admin-label">Public story consent</dt><dd>{b.consentPublic ? <Badge tone="green">Consent on file</Badge> : <Badge>No consent</Badge>}</dd></div>
              <div><dt className="admin-label">Assistance records</dt><dd>{b.assistance.length}</dd></div>
            </dl>
          </Section>

          <Section title="Case notes">
            {manage && (
              <form className="mb-4 space-y-2" onSubmit={(e) => { e.preventDefault(); if (note.note.trim().length >= 2) addNote.mutate(undefined); }}>
                <label className="sr-only" htmlFor="case-note">Case note</label>
                <textarea id="case-note" className="admin-input min-h-[90px]" maxLength={2000} placeholder="Visit summary, needs, referrals…" value={note.note} onChange={(e) => setNote({ ...note, note: e.target.value })} />
                <AdminField label="Follow-up date (optional)"><input type="date" className="admin-input" min={isoDay()} value={note.followUpAt} onChange={(e) => setNote({ ...note, followUpAt: e.target.value })} /></AdminField>
                <div className="flex justify-end"><Button size="sm" type="submit" loading={addNote.isPending} disabled={note.note.trim().length < 2}>Add note</Button></div>
              </form>
            )}
            {b.caseNotes.length === 0 ? (
              <p className="text-sm text-ink-muted">No case notes yet.</p>
            ) : (
              <ul className="space-y-3">
                {b.caseNotes.map((n) => (
                  <li key={n.id} className="rounded-xl bg-surface-alt/60 p-3">
                    <p className="whitespace-pre-wrap text-sm">{n.note}</p>
                    <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-ink-muted">
                      {dateTime(n.createdAt)}
                      {n.followUpAt && <Badge tone={new Date(n.followUpAt) < new Date() ? 'red' : 'blue'}><CalendarClock className="h-3 w-3" aria-hidden /> Follow up {date(n.followUpAt)}</Badge>}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>
      </div>
      <AssistanceModal open={assistOpen} onClose={() => setAssistOpen(false)} beneficiaryId={b.id} defaultProjectId={b.projectId ?? ''} invalidate={inv} />
    </AdminPage>
  );
}

function AssistanceModal({ open, onClose, beneficiaryId, defaultProjectId, invalidate }: { open: boolean; onClose: () => void; beneficiaryId: string; defaultProjectId: string; invalidate: unknown[][] }) {
  const blank = { type: '', description: '', quantity: '1', unit: 'unit', value: '', distributedAt: isoDay(), projectId: defaultProjectId };
  const [f, setF] = useState(blank);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const projects = useOptions('projects', open);
  useEffect(() => {
    if (open) setF((x) => ({ ...x, projectId: x.projectId || defaultProjectId }));
  }, [open, defaultProjectId]);
  const save = useApiMutation(
    () =>
      send(`/admin/beneficiaries/${beneficiaryId}/assistance`, {
        type: f.type.trim(),
        description: f.description,
        quantity: Number(f.quantity),
        unit: f.unit.trim() || 'unit',
        valueAmount: f.value ? toMinor(Number(f.value)) : null,
        distributedAt: f.distributedAt,
        projectId: f.projectId || null,
      }),
    {
      success: 'Assistance recorded',
      invalidate,
      onFieldErrors: setErrors,
      onSuccess: () => {
        setF(blank);
        onClose();
      },
    },
  );
  const upd = (k: keyof typeof blank) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }));
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Record assistance"
      footer={
        <>
          <Button size="sm" variant="outline" onClick={onClose}>Cancel</Button>
          <Button size="sm" type="submit" form="assist-form" loading={save.isPending}>Record</Button>
        </>
      }
    >
      <form id="assist-form" className="grid gap-4 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); save.mutate(undefined); }}>
        <AdminField label="Type" required error={errors.type} className="sm:col-span-2" help="e.g. Food kit, Scholarship, Medical consultation">
          <input className="admin-input" required minLength={2} maxLength={80} value={f.type} onChange={upd('type')} list="assist-types" />
          <datalist id="assist-types">{['Food kit', 'Scholarship', 'Medical consultation', 'School supplies', 'Hygiene kit', 'Cash transfer'].map((t) => <option key={t} value={t} />)}</datalist>
        </AdminField>
        <AdminField label="Quantity" required error={errors.quantity}><input type="number" className="admin-input" required min="0.01" step="any" value={f.quantity} onChange={upd('quantity')} /></AdminField>
        <AdminField label="Unit" error={errors.unit}><input className="admin-input" maxLength={30} value={f.unit} onChange={upd('unit')} /></AdminField>
        <AdminField label="Value (₹, optional)" error={errors.valueAmount}><input type="number" className="admin-input" min="0" step="0.01" value={f.value} onChange={upd('value')} /></AdminField>
        <AdminField label="Date distributed" required error={errors.distributedAt}><input type="date" className="admin-input" required max={isoDay()} value={f.distributedAt} onChange={upd('distributedAt')} /></AdminField>
        <AdminField label="Project" error={errors.projectId} className="sm:col-span-2">
          <select className="admin-input" value={f.projectId} onChange={upd('projectId')}>
            <option value="">— None —</option>
            {(projects.data ?? []).map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
        </AdminField>
        <AdminField label="Description" error={errors.description} className="sm:col-span-2"><textarea className="admin-input min-h-[60px]" maxLength={400} value={f.description} onChange={upd('description')} /></AdminField>
      </form>
    </Modal>
  );
}
