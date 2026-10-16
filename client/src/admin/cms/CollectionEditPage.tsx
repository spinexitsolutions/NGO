import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ExternalLink, Save, Users } from 'lucide-react';
import { COLLECTION_MAP, defaultsFor } from '@ngo/shared';
import { useAuth } from '@/app/AuthProvider';
import { ApiError, get, send } from '@/lib/api';
import { dateTime } from '@/lib/format';
import { Button, Spinner, StatusBadge, useToast } from '@/components/ui';
import { AdminPage } from '../ui';
import { FieldForm, withDefaults, type FieldErrors } from './FieldForm';

type Values = Record<string, unknown>;

export default function CollectionEditPage() {
  const { collection = '', id = 'new' } = useParams();
  const def = COLLECTION_MAP[collection];
  const isNew = id === 'new';
  const navigate = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const { can } = useAuth();
  const { data, isLoading } = useQuery({ queryKey: ['admin', 'record', collection, id], queryFn: () => get<Values>(`/admin/collections/${collection}/${id}`), enabled: Boolean(def) && !isNew });
  const [value, setValue] = useState<Values | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!def) return;
    if (isNew) setValue({ ...defaultsFor(def.fields), status: def.statusOptions[0].value });
    else if (data) setValue(withDefaults(def.fields, data));
  }, [def, isNew, data]);

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => dirty && e.preventDefault();
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  const canPublish = useMemo(() => !def?.publishPermission || can(def.publishPermission), [def, can]);
  if (!def) return <Navigate to="/admin" replace />;
  if (!value || (!isNew && isLoading)) return <div className="grid min-h-[50vh] place-items-center"><Spinner /></div>;

  const save = async (statusOverride?: string) => {
    setSaving(true);
    setErrors({});
    const body: Values = { ...value, ...(statusOverride ? { status: statusOverride } : {}) };
    // Only send defined fields + status
    const payload = Object.fromEntries([...def.fields.map((f) => [f.name, body[f.name]]), ['status', body.status]]);
    try {
      const saved = isNew ? await send<Values>(`/admin/collections/${collection}`, payload) : await send<Values>(`/admin/collections/${collection}/${id}`, payload, 'PUT');
      toast(isNew ? `${def.singular} created` : 'Changes saved');
      setDirty(false);
      qc.invalidateQueries({ queryKey: ['admin', 'collection'] });
      qc.invalidateQueries({ queryKey: ['admin', 'options', collection] });
      if (isNew) navigate(`/admin/content/${collection}/${saved.id}`, { replace: true });
      else {
        setValue(withDefaults(def.fields, saved));
        qc.setQueryData(['admin', 'record', collection, id], saved);
      }
    } catch (e) {
      if (e instanceof ApiError) {
        setErrors(e.fieldErrors);
        toast(e.message, 'error');
      } else toast('Save failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  const status = String(value.status);
  const isPublic = def.publicStatuses.includes(status);
  const title = String(value[def.titleField] || (isNew ? `New ${def.singular.toLowerCase()}` : def.singular));

  return (
    <AdminPage
      title={title}
      back={{ href: `/admin/content/${collection}`, label: def.label }}
      description={!isNew && data ? <>Last updated {dateTime(data.updatedAt as string)} · <StatusBadge status={String(data.status)} /></> : def.description}
      actions={
        <>
          {!isNew && collection === 'events' && <Link to={`/admin/events/${id}/registrations`} className="btn btn-outline btn-sm"><Users className="h-4 w-4" /> Registrations</Link>}
          {!isNew && def.publicPath && def.hasSlug && isPublic && <a href={`${def.publicPath}/${value.slug}`} target="_blank" rel="noopener" className="btn btn-outline btn-sm"><ExternalLink className="h-4 w-4" /> View on site</a>}
        </>
      }
    >
      {Boolean(data?.isSample) && (
        <div className="mb-5 flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
          <p>This is <strong>sample content</strong> shown with a “Sample” badge on the website. Editing and saving it converts it to real content — replace the text and photographs with your own first.</p>
        </div>
      )}
      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <form className="admin-card" onSubmit={(e) => { e.preventDefault(); save(); }} onChange={() => setDirty(true)}>
          <FieldForm fields={def.fields} value={value} onChange={(v) => { setValue(v); setDirty(true); }} errors={errors} />
        </form>
        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <div className="admin-card space-y-4">
            <label className="block">
              <span className="admin-label">Status</span>
              <select className="admin-input" value={status} onChange={(e) => { setValue({ ...value, status: e.target.value }); setDirty(true); }}>
                {def.statusOptions.map((s) => (
                  <option key={s.value} value={s.value} disabled={!canPublish && def.publicStatuses.includes(s.value) && s.value !== String(data?.status)}>{s.label}</option>
                ))}
              </select>
              {!canPublish && <span className="field-help">You can save drafts. Publishing needs an editor with publish rights.</span>}
            </label>
            {errors.status && <p className="field-error">{errors.status}</p>}
            <Button className="w-full" onClick={() => save()} loading={saving} icon={Save}>{isNew ? 'Create' : 'Save changes'}</Button>
            {canPublish && !isPublic && def.publicStatuses[0] && (
              <Button variant="outline" className="w-full" onClick={() => save(def.publicStatuses[0])} disabled={saving}>Save & publish</Button>
            )}
            {dirty && <p className="text-center text-xs text-amber-700">Unsaved changes</p>}
          </div>
          {Object.keys(errors).length > 0 && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900" role="alert">
              <p className="font-semibold">Please fix:</p>
              <ul className="mt-1 list-disc pl-5">{Object.entries(errors).map(([k, m]) => <li key={k}>{def.fields.find((f) => f.name === k.split('.')[0])?.label ?? k}: {m}</li>)}</ul>
            </div>
          )}
          {collection === 'campaigns' && !isNew && (
            <div className="admin-card text-sm">
              <p className="font-semibold">Campaign updates</p>
              <p className="mt-1 text-ink-muted">Post progress updates that appear on the campaign page.</p>
              <Link className="mt-3 inline-block font-semibold text-primary" to="/admin/content/campaignUpdates">Manage updates →</Link>
            </div>
          )}
          {collection === 'projects' && !isNew && (
            <div className="admin-card text-sm">
              <p className="font-semibold">Updates & reports</p>
              <Link className="mt-2 inline-block font-semibold text-primary" to="/admin/content/projectReports">Manage project updates →</Link>
            </div>
          )}
        </aside>
      </div>
    </AdminPage>
  );
}
