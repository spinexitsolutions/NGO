import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Copy, ExternalLink, Lock, Plus, Trash2 } from 'lucide-react';
import { slugify } from '@ngo/shared';
import { ApiError, api, get, send } from '@/lib/api';
import { dateTime } from '@/lib/format';
import { Badge, Button, Field, Input, Modal, StatusBadge, useConfirm, useToast } from '@/components/ui';
import { AdminPage, DataTable, QueryError, SearchInput } from '../ui';

interface PageRow { id: string; slug: string; title: string; status: string; isSystem: boolean; scheduledAt: string | null; updatedAt: string; publishedVersion: number | null; hasUnpublishedChanges: boolean; sectionCount: number }

export default function PagesListPage() {
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['admin', 'pages'], queryFn: () => get<PageRow[]>('/admin/pages') });
  const [q, setQ] = useState('');
  const [creating, setCreating] = useState(false);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();
  const rows = data?.filter((p) => !q || `${p.title} ${p.slug}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <AdminPage title="Pages & sections" description="Edit any page with the visual section builder: add, reorder (drag & drop), hide, duplicate and configure sections, preview the draft, then publish." actions={<Button size="sm" icon={Plus} onClick={() => setCreating(true)}>New page</Button>}>
      <div className="mb-4"><SearchInput value={q} onChange={setQ} placeholder="Search pages" /></div>
      {error ? <QueryError error={error} retry={refetch} /> : (
        <DataTable<PageRow>
          rows={rows}
          loading={isLoading}
          rowHref={(p) => `/admin/website/pages/${p.id}`}
          onRowClick={(p) => navigate(`/admin/website/pages/${p.id}`)}
          columns={[
            { key: 'title', header: 'Page', render: (p) => <span className="flex items-center gap-2">{p.title || p.slug}{p.isSystem && <Lock className="h-3.5 w-3.5 text-ink-muted" aria-label="System page" />}</span> },
            { key: 'slug', header: 'URL', render: (p) => <code className="text-xs text-ink-muted">/{p.slug === 'home' ? '' : p.slug}</code> },
            { key: 'status', header: 'Status', render: (p) => <span className="flex flex-wrap gap-1"><StatusBadge status={p.publishedVersion ? p.status : 'DRAFT'} />{p.hasUnpublishedChanges && p.publishedVersion && <Badge tone="amber">Unpublished edits</Badge>}</span> },
            { key: 'sections', header: 'Sections', render: (p) => p.sectionCount },
            { key: 'updated', header: 'Updated', render: (p) => <span className="whitespace-nowrap text-ink-muted">{dateTime(p.updatedAt)}</span> },
            {
              key: 'actions', header: <span className="sr-only">Actions</span>, className: 'text-right',
              render: (p) => (
                <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                  {p.publishedVersion && <a href={p.slug === 'home' ? '/' : `/${p.slug}`} target="_blank" rel="noopener" className="rounded-lg p-2 text-ink-muted hover:bg-ink/5" aria-label="View live page"><ExternalLink className="h-4 w-4" /></a>}
                  <button className="rounded-lg p-2 text-ink-muted hover:bg-ink/5" aria-label="Duplicate" onClick={async () => { const r = await send<{ id: string }>(`/admin/pages/${p.id}/duplicate`); toast('Page duplicated as a draft'); navigate(`/admin/website/pages/${r.id}`); }}><Copy className="h-4 w-4" /></button>
                  {!p.isSystem && (
                    <button className="rounded-lg p-2 text-ink-muted hover:bg-red-50 hover:text-red-700" aria-label="Delete page" onClick={async () => {
                      if (!(await confirm({ title: `Delete “${p.title}”?`, message: 'The page and its version history will be deleted. Links to it will show “not found”.', danger: true, confirmLabel: 'Delete', typeToConfirm: p.slug }))) return;
                      try { await api(`/admin/pages/${p.id}`, { method: 'DELETE', body: { confirm: true } }); toast('Page deleted'); qc.invalidateQueries({ queryKey: ['admin', 'pages'] }); } catch (e) { toast(e instanceof ApiError ? e.message : 'Delete failed', 'error'); }
                    }}><Trash2 className="h-4 w-4" /></button>
                  )}
                </div>
              ),
            },
          ]}
        />
      )}
      <NewPageModal open={creating} onClose={() => setCreating(false)} onCreated={(id) => navigate(`/admin/website/pages/${id}`)} />
    </AdminPage>
  );
}

function NewPageModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (id: string) => void }) {
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [template, setTemplate] = useState<'standard' | 'blank'>('standard');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  return (
    <Modal open={open} onClose={onClose} title="Create a page" footer={<><Button variant="outline" size="sm" onClick={onClose}>Cancel</Button><Button size="sm" loading={busy} onClick={async () => {
      setBusy(true); setErrors({});
      try { const p = await send<{ id: string }>('/admin/pages', { title, slug: slug || slugify(title), template }); onCreated(p.id); } catch (e) { if (e instanceof ApiError) setErrors({ ...e.fieldErrors, _: e.message }); } finally { setBusy(false); }
    }}>Create</Button></>}>
      <div className="space-y-4">
        <Field label="Title" required error={errors.title}>{(id) => <Input id={id} value={title} onChange={(e) => { setTitle(e.target.value); setSlug(slugify(e.target.value)); }} />}</Field>
        <Field label="URL" required error={errors.slug} help={`The page will be available at /${slug || 'your-page'}`}>{(id, d) => <Input id={id} aria-describedby={d} value={slug} onChange={(e) => setSlug(slugify(e.target.value))} />}</Field>
        <fieldset className="grid grid-cols-2 gap-2">
          <legend className="field-label">Start with</legend>
          {(['standard', 'blank'] as const).map((t) => (
            <button key={t} type="button" aria-pressed={template === t} onClick={() => setTemplate(t)} className={`rounded-xl border p-3 text-left text-sm ${template === t ? 'border-primary ring-2 ring-primary/25' : 'border-line'}`}>
              <span className="font-semibold">{t === 'standard' ? 'Hero + text + CTA' : 'Blank page'}</span>
            </button>
          ))}
        </fieldset>
        {errors._ && <p className="field-error">{errors._}</p>}
      </div>
    </Modal>
  );
}
