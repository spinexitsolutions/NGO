/** Beneficiary form + privacy notice shared by the list (create) and detail (edit) screens. */
import { Lock } from 'lucide-react';
import { Checkbox } from '@/components/ui';
import { AdminField, isoDay, useOptions } from './_common';

export function PrivacyNotice() {
  return (
    <div role="note" className="mb-5 flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
      <Lock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <p>
        <strong>Sensitive data — access is logged.</strong> Beneficiary records may include minors and vulnerable people. View only what you need, never share names,
        photos or contact details outside the team, and use the aggregated summary for reporting.
      </p>
    </div>
  );
}

export interface BeneficiaryFormValue {
  fullName: string;
  gender: string;
  dateOfBirth: string;
  guardianName: string;
  phone: string;
  address: string;
  village: string;
  district: string;
  projectId: string;
  programs: string;
  status: string;
  consentPublic: boolean;
}

export const blankBeneficiary: BeneficiaryFormValue = { fullName: '', gender: '', dateOfBirth: '', guardianName: '', phone: '', address: '', village: '', district: '', projectId: '', programs: '', status: 'ACTIVE', consentPublic: false };

export function beneficiaryPayload(f: BeneficiaryFormValue) {
  return {
    ...f,
    dateOfBirth: f.dateOfBirth || null,
    projectId: f.projectId || null,
    programs: f.programs.split(',').map((p) => p.trim()).filter(Boolean).slice(0, 10),
  };
}

export function isMinorDob(dob: string) {
  return Boolean(dob) && Date.now() - new Date(dob).getTime() < 18 * 365.25 * 86_400_000;
}

export function BeneficiaryForm({ value: f, onChange, errors, disabled }: { value: BeneficiaryFormValue; onChange: (v: BeneficiaryFormValue) => void; errors: Record<string, string>; disabled?: boolean }) {
  const projects = useOptions('projects');
  const upd = (k: keyof BeneficiaryFormValue) => (e: { target: { value: string } }) => onChange({ ...f, [k]: e.target.value });
  const minor = isMinorDob(f.dateOfBirth);
  return (
    <fieldset disabled={disabled} className="grid gap-4 sm:grid-cols-2">
      <AdminField label="Full name" required error={errors.fullName}><input className="admin-input" required minLength={2} maxLength={120} value={f.fullName} onChange={upd('fullName')} /></AdminField>
      <AdminField label="Gender" error={errors.gender}>
        <select className="admin-input" value={f.gender} onChange={upd('gender')}>
          <option value="">Not recorded</option>
          <option value="FEMALE">Female</option>
          <option value="MALE">Male</option>
          <option value="OTHER">Other</option>
          <option value="UNDISCLOSED">Prefer not to say</option>
        </select>
      </AdminField>
      <AdminField label="Date of birth" error={errors.dateOfBirth} help={minor ? 'Under 18 — this record will be flagged as a minor.' : undefined}>
        <input type="date" className="admin-input" max={isoDay()} value={f.dateOfBirth} onChange={upd('dateOfBirth')} />
      </AdminField>
      <AdminField label={minor ? 'Guardian name (recommended for minors)' : 'Guardian name'} error={errors.guardianName}><input className="admin-input" maxLength={120} value={f.guardianName} onChange={upd('guardianName')} /></AdminField>
      <AdminField label="Phone" error={errors.phone}><input className="admin-input" maxLength={20} value={f.phone} onChange={upd('phone')} /></AdminField>
      <AdminField label="Status" error={errors.status}>
        <select className="admin-input" value={f.status} onChange={upd('status')}>
          <option value="ACTIVE">Active</option>
          <option value="FOLLOW_UP">Follow-up</option>
          <option value="EXITED">Exited</option>
        </select>
      </AdminField>
      <AdminField label="Address" className="sm:col-span-2" error={errors.address}><textarea className="admin-input min-h-[60px]" maxLength={400} value={f.address} onChange={upd('address')} /></AdminField>
      <AdminField label="Village / locality" error={errors.village}><input className="admin-input" maxLength={120} value={f.village} onChange={upd('village')} /></AdminField>
      <AdminField label="District" error={errors.district}><input className="admin-input" maxLength={120} value={f.district} onChange={upd('district')} /></AdminField>
      <AdminField label="Project" error={errors.projectId}>
        <select className="admin-input" value={f.projectId} onChange={upd('projectId')}>
          <option value="">— None —</option>
          {(projects.data ?? []).map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
        </select>
      </AdminField>
      <AdminField label="Programmes" error={errors.programs} help="Comma-separated, e.g. Nutrition, Scholarship">
        <input className="admin-input" value={f.programs} onChange={upd('programs')} />
      </AdminField>
      <div className="sm:col-span-2">
        <Checkbox
          label={<>Consent to appear in public stories <span className="block text-xs text-ink-muted">Only tick if written consent (and guardian consent for minors) is on file.</span></>}
          checked={f.consentPublic}
          onChange={(e) => onChange({ ...f, consentPublic: e.target.checked })}
        />
      </div>
    </fieldset>
  );
}
