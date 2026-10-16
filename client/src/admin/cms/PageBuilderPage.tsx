import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  BadgeCheck, BarChart3, BookOpen, Briefcase, CalendarDays, ClipboardList, Compass, FileDown, FileText, FolderKanban, HandCoins, HandHeart, Handshake, HeartHandshake, HelpCircle,
  History as HistoryIcon, Image, Images, LayoutGrid, LayoutPanelLeft, ListOrdered, Mail, MapPin, Megaphone, Newspaper, PieChart, PlayCircle, Quote, Square, Target, Users, type LucideIcon,
} from 'lucide-react';
import { ArrowLeft, CalendarClock, CheckCircle2, CloudUpload, Copy, Eye, EyeOff, GripVertical, History, Loader2, Plus, RotateCcw, Save, Settings2, Trash2, X } from 'lucide-react';
import { SECTION_META, SECTION_TYPES, createSection, newSectionId, sectionPropsSchemas, zodIssues, type PageDraft, type Section, type SectionType } from '@ngo/shared';
import { ApiError, api, get, send } from '@/lib/api';
import { cn } from '@/lib/cn';
import { dateTime } from '@/lib/format';
import { Badge, Button, Modal, Spinner, Tabs, useConfirm, useToast } from '@/components/ui';
import { PreviewFrame } from './configEditor';
import { FieldForm, withDefaults, type FieldErrors } from './FieldForm';

interface PageData {
  id: string; slug: string; isSystem: boolean; status: string; showInSitemap: boolean; scheduledAt: string | null; updatedAt: string;
  draft: PageDraft; publishedVersion: { version: number; createdAt: string } | null;
}
interface SectionErrorItem { index: number; id: string; type: string; issues: { path: string; message: string }[] }

const SECTION_ICONS: Record<string, LucideIcon> = {
  BadgeCheck, BarChart3, BookOpen, Briefcase, CalendarDays, ClipboardList, Compass, FileDown, FileText, FolderKanban, HandCoins, HandHeart, Handshake, HeartHandshake, HelpCircle,
  History: HistoryIcon, Image, Images, LayoutGrid, LayoutPanelLeft, ListOrdered, Mail, MapPin, Megaphone, Newspaper, PieChart, PlayCircle, Quote, Target, Users,
};

function SectionIcon({ type, className }: { type: string; className?: string }) {
  const C = SECTION_ICONS[SECTION_META[type as SectionType]?.icon ?? ''] ?? Square;
  return <C className={className} aria-hidden />;
}

/** Client-side validation with the same schemas the server uses on publish. */
function validate(sections: Section[]): Record<string, FieldErrors> {
  const out: Record<string, FieldErrors> = {};
  for (const s of sections) {
    const r = sectionPropsSchemas[s.type as SectionType]?.safeParse(s.props);
    if (r && !r.success) out[s.id] = Object.fromEntries(zodIssues(r.error).map((i) => [i.path, i.message]));
  }
  return out;
}

function sectionSummary(s: Section) {
  const p = s.props as Record<string, unknown>;
  return String(p.heading || p.eyebrow || (typeof p.body === 'string' ? p.body.slice(0, 50) : '') || '');
}

function SortableRow({ s, selected, error, onSelect, onToggle, onDuplicate, onDelete }: { s: Section; selected: boolean; error: boolean; onSelect: () => void; onToggle: () => void; onDuplicate: () => void; onDelete: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: s.id });
  return (
    <li ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={cn('group flex items-center gap-1 rounded-xl border bg-surface pr-1 transition', selected ? 'border-primary ring-2 ring-primary/20' : error ? 'border-red-400' : 'border-line', isDragging && 'z-10 shadow-2xl', !s.visible && 'opacity-60')}>
      <button className="cursor-grab touch-none p-2.5 text-ink-muted hover:text-ink active:cursor-grabbing" aria-label={`Drag to reorder ${SECTION_META[s.type as SectionType]?.label}`} {...attributes} {...listeners}>
        <GripVertical className="h-4 w-4" />
      </button>
      <button className="flex min-w-0 flex-1 items-center gap-2.5 py-2.5 text-left" onClick={onSelect} aria-current={selected}>
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><SectionIcon type={s.type} className="h-4 w-4" /></span>
        <span className="min-w-0">
          <span className="flex items-center gap-1.5 text-sm font-semibold">{SECTION_META[s.type as SectionType]?.label ?? s.type}{error && <span className="h-2 w-2 rounded-full bg-red-500" aria-label="has errors" />}</span>
          <span className="block truncate text-xs text-ink-muted">{sectionSummary(s) || '—'}</span>
        </span>
      </button>
      <button onClick={onToggle} className="rounded-lg p-1.5 text-ink-muted hover:bg-ink/5 hover:text-ink" aria-label={s.visible ? 'Hide section' : 'Show section'} title={s.visible ? 'Hide' : 'Show'}>{s.visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}</button>
      <button onClick={onDuplicate} className="rounded-lg p-1.5 text-ink-muted hover:bg-ink/5 hover:text-ink" aria-label="Duplicate section" title="Duplicate"><Copy className="h-4 w-4" /></button>
      <button onClick={onDelete} className="rounded-lg p-1.5 text-ink-muted hover:bg-red-50 hover:text-red-700" aria-label="Remove section" title="Remove"><Trash2 className="h-4 w-4" /></button>
    </li>
  );
}

export default function PageBuilderPage() {
  const { id = '' } = useParams();
  const qc = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();
  const { data, isLoading, refetch } = useQuery({ queryKey: ['admin', 'page', id], queryFn: () => get<PageData>(`/admin/pages/${id}`) });
  const [draft, setDraft] = useState<PageDraft | null>(null);
  const [selected, setSelected] = useState<string | 'page' | null>('page');
  const [save, setSave] = useState<'saved' | 'dirty' | 'saving' | 'error'>('saved');
  const [serverErrors, setServerErrors] = useState<SectionErrorItem[]>([]);
  const [adding, setAdding] = useState<number | null>(null);
  const [mode, setMode] = useState<'edit' | 'preview'>('edit');
  const [modal, setModal] = useState<'versions' | 'schedule' | 'settings' | null>(null);
  const [publishing, setPublishing] = useState(false);
  const timer = useRef<number>();
  const latest = useRef<PageDraft | null>(null);

  useEffect(() => {
    if (data && !draft) setDraft(data.draft);
  }, [data, draft]);

  const persist = useCallback(async (d: PageDraft) => {
    setSave('saving');
    try {
      await send(`/admin/pages/${id}/draft`, d, 'PUT');
      setSave('saved');
      return true;
    } catch (e) {
      setSave('error');
      toast(e instanceof ApiError ? e.message : 'Could not save', 'error');
      return false;
    }
  }, [id, toast]);

  const update = useCallback((d: PageDraft) => {
    setDraft(d);
    latest.current = d;
    setSave('dirty');
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => latest.current && persist(latest.current), 1500);
  }, [persist]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        window.clearTimeout(timer.current);
        if (latest.current) persist(latest.current);
      }
    };
    const onUnload = (e: BeforeUnloadEvent) => { if (save === 'dirty' || save === 'saving') e.preventDefault(); };
    window.addEventListener('keydown', onKey);
    window.addEventListener('beforeunload', onUnload);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('beforeunload', onUnload); };
  }, [persist, save]);

  const clientErrors = useMemo(() => (draft ? validate(draft.sections) : {}), [draft]);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  if (isLoading || !data || !draft) return <div className="grid min-h-[60vh] place-items-center"><Spinner /></div>;

  const sections = draft.sections;
  const setSections = (next: Section[]) => update({ ...draft, sections: next });
  const current = sections.find((s) => s.id === selected);
  const errorCount = Object.keys(clientErrors).length + (draft.title.trim() ? 0 : 1);

  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    const from = sections.findIndex((s) => s.id === e.active.id);
    const to = sections.findIndex((s) => s.id === e.over!.id);
    setSections(arrayMove(sections, from, to));
  };

  const publish = async () => {
    window.clearTimeout(timer.current);
    if (errorCount) {
      const first = Object.keys(clientErrors)[0];
      setSelected(first ?? 'page');
      return toast(`${errorCount} item(s) need attention before publishing`, 'error');
    }
    setPublishing(true);
    try {
      if (!(await persist(draft))) return;
      const r = await send<{ version: number }>(`/admin/pages/${id}/publish`, { note: '' });
      setServerErrors([]);
      toast(`Published version ${r.version} — live now`);
      refetch();
      qc.invalidateQueries({ queryKey: ['admin', 'pages'] });
    } catch (e) {
      if (e instanceof ApiError && Array.isArray(e.details)) {
        setServerErrors(e.details as SectionErrorItem[]);
        setSelected((e.details as SectionErrorItem[])[0]?.id ?? 'page');
      }
      toast(e instanceof ApiError ? e.message : 'Publish failed', 'error');
    } finally {
      setPublishing(false);
    }
  };

  const liveHref = data.slug === 'home' ? '/' : `/${data.slug}`;
  const sectionErrors = (sid: string): FieldErrors => ({ ...clientErrors[sid], ...Object.fromEntries((serverErrors.find((x) => x.id === sid)?.issues ?? []).map((i) => [i.path, i.message])) });

  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col">
      <div className="sticky top-16 z-20 flex flex-wrap items-center gap-2 border-b border-line bg-bg/95 px-4 py-3 backdrop-blur sm:px-6">
        <Link to="/admin/website/pages" className="rounded-full p-2 hover:bg-ink/5" aria-label="Back to pages"><ArrowLeft className="h-5 w-5" /></Link>
        <div className="min-w-0">
          <p className="truncate font-heading text-xl leading-tight">{draft.title || 'Untitled page'}</p>
          <p className="flex flex-wrap items-center gap-2 text-xs text-ink-muted">
            <code>{liveHref}</code>
            {data.publishedVersion ? <Badge tone="green">Live v{data.publishedVersion.version}</Badge> : <Badge>Not published</Badge>}
            {data.status === 'SCHEDULED' && data.scheduledAt && <Badge tone="blue">Scheduled {dateTime(data.scheduledAt)}</Badge>}
            <span className={cn('inline-flex items-center gap-1', save === 'error' ? 'text-red-700' : save === 'saved' ? 'text-emerald-700' : 'text-amber-700')} role="status">
              {save === 'saving' ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
              {{ saved: 'Draft saved', dirty: 'Unsaved changes', saving: 'Saving…', error: 'Save failed' }[save]}
            </span>
          </p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Tabs tabs={[{ value: 'edit', label: 'Edit' }, { value: 'preview', label: 'Preview draft' }] as const} value={mode} onChange={setMode} className="border-0" />
          <Button variant="ghost" size="sm" icon={Settings2} onClick={() => setModal('settings')}>Settings</Button>
          <Button variant="ghost" size="sm" icon={History} onClick={() => setModal('versions')}>Versions</Button>
          <Button variant="outline" size="sm" icon={CalendarClock} onClick={() => setModal('schedule')}>Schedule</Button>
          <Button variant="outline" size="sm" icon={Save} onClick={() => { window.clearTimeout(timer.current); persist(draft); }}>Save</Button>
          <Button size="sm" icon={CloudUpload} loading={publishing} onClick={publish}>Publish{errorCount ? ` (${errorCount})` : ''}</Button>
        </div>
      </div>

      {mode === 'preview' ? (
        <div className="flex-1 p-4 sm:p-6"><div className="h-[calc(100vh-11rem)]"><PreviewFrame path="/__preview" payload={{ page: draft }} /></div></div>
      ) : (
        <div className="grid flex-1 gap-6 p-4 sm:p-6 lg:grid-cols-[380px_1fr]">
          <aside className="space-y-3 lg:sticky lg:top-36 lg:max-h-[calc(100vh-10rem)] lg:self-start lg:overflow-y-auto">
            <button onClick={() => setSelected('page')} className={cn('flex w-full items-center gap-3 rounded-xl border p-3 text-left text-sm', selected === 'page' ? 'border-primary ring-2 ring-primary/20' : 'border-line bg-surface', !draft.title.trim() && 'border-red-400')}>
              <Settings2 className="h-4 w-4 text-ink-muted" /> <span className="font-semibold">Page title & SEO</span>
            </button>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
              <SortableContext items={sections.map((s) => s.id)} strategy={verticalListSortingStrategy}>
                <ul className="space-y-2" aria-label="Page sections (drag to reorder)">
                  {sections.map((s, i) => (
                    <SortableRow
                      key={s.id}
                      s={s}
                      selected={selected === s.id}
                      error={Boolean(clientErrors[s.id] || serverErrors.find((x) => x.id === s.id))}
                      onSelect={() => setSelected(s.id)}
                      onToggle={() => setSections(sections.map((x) => (x.id === s.id ? { ...x, visible: !x.visible } : x)))}
                      onDuplicate={() => { const copy = { ...structuredClone(s), id: newSectionId() }; setSections([...sections.slice(0, i + 1), copy, ...sections.slice(i + 1)]); setSelected(copy.id); }}
                      onDelete={async () => { if (await confirm({ title: 'Remove this section?', message: 'You can restore it later from Versions if it was published.', danger: true, confirmLabel: 'Remove' })) { setSections(sections.filter((x) => x.id !== s.id)); setSelected('page'); } }}
                    />
                  ))}
                </ul>
              </SortableContext>
            </DndContext>
            <Button variant="outline" className="w-full" icon={Plus} onClick={() => setAdding(sections.length)}>Add section</Button>
          </aside>

          <section className="admin-card min-w-0" aria-label="Section editor">
            {selected === 'page' || !current ? (
              <div className="space-y-5">
                <h2 className="font-heading text-2xl">Page title & SEO</h2>
                <label className="block"><span className="admin-label">Page title *</span><input className="admin-input" value={draft.title} maxLength={160} onChange={(e) => update({ ...draft, title: e.target.value })} aria-invalid={!draft.title.trim() || undefined} />{!draft.title.trim() && <span className="field-error">Title is required</span>}</label>
                <label className="block"><span className="admin-label">SEO title ({draft.seo.title.length}/70)</span><input className="admin-input" value={draft.seo.title} maxLength={70} placeholder={draft.title} onChange={(e) => update({ ...draft, seo: { ...draft.seo, title: e.target.value } })} /></label>
                <label className="block"><span className="admin-label">Meta description ({draft.seo.description.length}/170)</span><textarea className="admin-input" rows={3} maxLength={170} value={draft.seo.description} onChange={(e) => update({ ...draft, seo: { ...draft.seo, description: e.target.value } })} /></label>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-[rgb(var(--c-primary))]" checked={draft.seo.noIndex} onChange={(e) => update({ ...draft, seo: { ...draft.seo, noIndex: e.target.checked } })} /> Hide from search engines (noindex)</label>
                <div className="rounded-xl bg-surface-alt p-4">
                  <p className="text-xs text-ink-muted">Search result preview</p>
                  <p className="mt-1 truncate text-lg text-[#1a0dab] dark:text-sky-300">{draft.seo.title || draft.title}</p>
                  <p className="text-xs text-emerald-800 dark:text-emerald-300">{window.location.origin}{liveHref}</p>
                  <p className="mt-1 line-clamp-2 text-sm text-ink-muted">{draft.seo.description || 'Add a meta description to control how this page appears in search results.'}</p>
                </div>
              </div>
            ) : (
              <SectionEditor
                key={current.id}
                section={current}
                errors={sectionErrors(current.id)}
                onChange={(s) => setSections(sections.map((x) => (x.id === s.id ? s : x)))}
                onAddAfter={() => setAdding(sections.findIndex((x) => x.id === current.id) + 1)}
              />
            )}
          </section>
        </div>
      )}

      <AddSectionModal open={adding !== null} onClose={() => setAdding(null)} onAdd={(s) => { const at = adding ?? sections.length; setSections([...sections.slice(0, at), s, ...sections.slice(at)]); setSelected(s.id); setAdding(null); }} />
      <VersionsModal open={modal === 'versions'} pageId={id} onClose={() => setModal(null)} onRestored={async () => { const p = await get<PageData>(`/admin/pages/${id}`); setDraft(p.draft); setSave('saved'); toast('Version copied into the draft — review and publish'); }} />
      <ScheduleModal open={modal === 'schedule'} pageId={id} onClose={() => setModal(null)} beforeSchedule={() => persist(draft)} onDone={() => refetch()} />
      <PageSettingsModal open={modal === 'settings'} page={data} onClose={() => setModal(null)} onSaved={() => refetch()} />
    </div>
  );
}

function SectionEditor({ section, errors, onChange, onAddAfter }: { section: Section; errors: FieldErrors; onChange: (s: Section) => void; onAddAfter: () => void }) {
  const meta = SECTION_META[section.type as SectionType];
  const confirm = useConfirm();
  const toast = useToast();
  const props = withDefaults(meta.fields, section.props as Record<string, unknown>);
  return (
    <div>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary"><SectionIcon type={section.type} className="h-5 w-5" /></span>
          <div>
            <h2 className="font-heading text-2xl">{meta.label}</h2>
            <p className="text-sm text-ink-muted">{meta.description}</p>
            {meta.dataSource && <p className="mt-1 text-xs text-primary">Shows live data — manage the items in the admin, not here.</p>}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" icon={RotateCcw} onClick={async () => { if (await confirm({ title: 'Reset this section?', message: 'All fields return to their default values.', confirmLabel: 'Reset' })) onChange({ ...section, props: structuredClone(meta.defaults) }); }}>Reset</Button>
          <Button variant="ghost" size="sm" icon={Save} onClick={async () => {
            const name = window.prompt('Save this section as a reusable template. Name:', meta.label);
            if (!name) return;
            try { await send('/admin/section-templates', { name, section }); toast('Saved to your section templates'); } catch (e) { toast(e instanceof ApiError ? e.message : 'Could not save template', 'error'); }
          }}>Save as template</Button>
          <Button variant="outline" size="sm" icon={Plus} onClick={onAddAfter}>Add below</Button>
        </div>
      </div>
      <div className="mb-6 grid gap-4 rounded-xl bg-surface-alt/60 p-4 sm:grid-cols-2">
        <label className="block"><span className="admin-label">Background</span>
          <select className="admin-input" value={section.background} onChange={(e) => onChange({ ...section, background: e.target.value as Section['background'] })}>
            <option value="default">Default</option><option value="alt">Alternate tint</option><option value="dark">Dark</option>
          </select>
        </label>
        <label className="block"><span className="admin-label">Anchor id (for #links)</span>
          <input className="admin-input" value={section.anchor} placeholder="e.g. our-work" onChange={(e) => onChange({ ...section, anchor: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })} />
        </label>
      </div>
      <FieldForm fields={meta.fields} value={props} onChange={(p) => onChange({ ...section, props: p })} errors={errors} groups={false} />
    </div>
  );
}

function AddSectionModal({ open, onClose, onAdd }: { open: boolean; onClose: () => void; onAdd: (s: Section) => void }) {
  const [tab, setTab] = useState<'blocks' | 'templates'>('blocks');
  const { data: templates, refetch } = useQuery({ queryKey: ['admin', 'section-templates'], queryFn: () => get<{ id: string; name: string; type: string; section: Section }[]>('/admin/section-templates'), enabled: open });
  return (
    <Modal open={open} onClose={onClose} title="Add a section" size="xl">
      <Tabs tabs={[{ value: 'blocks', label: 'Section types' }, { value: 'templates', label: `Saved templates${templates?.length ? ` (${templates.length})` : ''}` }] as const} value={tab} onChange={setTab} className="mb-5" />
      {tab === 'blocks' ? (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {SECTION_TYPES.map((t) => (
            <li key={t}>
              <button onClick={() => onAdd(createSection(t))} className="flex h-full w-full items-start gap-3 rounded-xl border border-line p-4 text-left transition hover:border-primary hover:bg-primary/5">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><SectionIcon type={t} className="h-5 w-5" /></span>
                <span><span className="block font-semibold">{SECTION_META[t].label}</span><span className="mt-0.5 block text-xs text-ink-muted">{SECTION_META[t].description}</span></span>
              </button>
            </li>
          ))}
        </ul>
      ) : !templates?.length ? (
        <p className="py-10 text-center text-sm text-ink-muted">No templates yet. Use “Save as template” on any section to reuse it across pages.</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {templates.map((t) => (
            <li key={t.id} className="flex items-center gap-3 rounded-xl border border-line p-3">
              <SectionIcon type={t.type} className="h-5 w-5 text-primary" />
              <span className="min-w-0 flex-1"><span className="block truncate font-semibold">{t.name}</span><span className="text-xs text-ink-muted">{SECTION_META[t.type as SectionType]?.label}</span></span>
              <Button size="sm" onClick={() => onAdd({ ...structuredClone(t.section), id: newSectionId() })}>Insert</Button>
              <button className="rounded-lg p-2 text-ink-muted hover:text-red-700" aria-label="Delete template" onClick={async () => { await api(`/admin/section-templates/${t.id}`, { method: 'DELETE' }); refetch(); }}><X className="h-4 w-4" /></button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}

function VersionsModal({ open, pageId, onClose, onRestored }: { open: boolean; pageId: string; onClose: () => void; onRestored: () => void }) {
  const { data, isLoading } = useQuery({ queryKey: ['admin', 'page-versions', pageId], queryFn: () => get<{ id: string; version: number; note: string; createdAt: string }[]>(`/admin/pages/${pageId}/versions`), enabled: open });
  return (
    <Modal open={open} onClose={onClose} title="Published versions">
      <p className="mb-4 text-sm text-ink-muted">Each publish creates an immutable version. Restoring copies it into the draft.</p>
      {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : !data?.length ? <p className="text-sm text-ink-muted">This page has not been published yet.</p> : (
        <ul className="divide-y divide-line">
          {data.map((v) => (
            <li key={v.id} className="flex items-center justify-between py-3">
              <div><p className="font-medium">Version {v.version}</p><p className="text-xs text-ink-muted">{dateTime(v.createdAt)} {v.note && `· ${v.note}`}</p></div>
              <Button size="sm" variant="outline" onClick={async () => { await send(`/admin/pages/${pageId}/versions/${v.id}/restore`); onClose(); onRestored(); }}>Restore to draft</Button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}

function ScheduleModal({ open, pageId, onClose, beforeSchedule, onDone }: { open: boolean; pageId: string; onClose: () => void; beforeSchedule: () => Promise<boolean>; onDone: () => void }) {
  const [at, setAt] = useState('');
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  return (
    <Modal open={open} onClose={onClose} title="Schedule publishing" size="sm" footer={<><Button variant="outline" size="sm" onClick={onClose}>Cancel</Button><Button size="sm" loading={busy} disabled={!at} onClick={async () => {
      setBusy(true);
      try { if (!(await beforeSchedule())) return; await send(`/admin/pages/${pageId}/schedule`, { at: new Date(at).toISOString() }); toast('Scheduled — the current draft will publish automatically'); onDone(); onClose(); } catch (e) { toast(e instanceof ApiError ? e.message : 'Could not schedule', 'error'); } finally { setBusy(false); }
    }}>Schedule</Button></>}>
      <label className="block"><span className="admin-label">Publish at</span><input type="datetime-local" className="admin-input" value={at} onChange={(e) => setAt(e.target.value)} /></label>
      <p className="mt-2 text-xs text-ink-muted">The draft as it is at that moment will be validated and published.</p>
    </Modal>
  );
}

function PageSettingsModal({ open, page, onClose, onSaved }: { open: boolean; page: PageData; onClose: () => void; onSaved: () => void }) {
  const [slug, setSlug] = useState(page.slug);
  const [sitemap, setSitemap] = useState(page.showInSitemap);
  const [err, setErr] = useState('');
  const toast = useToast();
  const confirm = useConfirm();
  return (
    <Modal open={open} onClose={onClose} title="Page settings" size="sm" footer={<>
      {page.publishedVersion && page.slug !== 'home' && <Button variant="danger" size="sm" onClick={async () => { if (await confirm({ title: 'Unpublish this page?', message: 'Visitors will see “page not found” until you publish again.', danger: true, confirmLabel: 'Unpublish' })) { await send(`/admin/pages/${page.id}/unpublish`); toast('Page unpublished'); onSaved(); onClose(); } }}>Unpublish</Button>}
      <Button size="sm" onClick={async () => { try { await send(`/admin/pages/${page.id}/settings`, { slug, showInSitemap: sitemap }, 'PUT'); toast('Settings saved (applies immediately)'); onSaved(); onClose(); } catch (e) { setErr(e instanceof ApiError ? Object.values(e.fieldErrors)[0] ?? e.message : 'Failed'); } }}>Save</Button>
    </>}>
      <div className="space-y-4">
        <label className="block"><span className="admin-label">URL slug</span><input className="admin-input font-mono" disabled={page.isSystem} value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))} />{page.isSystem && <span className="field-help">System page URLs are fixed.</span>}</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4" checked={sitemap} onChange={(e) => setSitemap(e.target.checked)} /> Include in sitemap.xml</label>
        <p className="text-xs text-ink-muted">These settings take effect immediately (they are not part of the draft).</p>
        {err && <p className="field-error">{err}</p>}
      </div>
    </Modal>
  );
}
