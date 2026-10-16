import { useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, Bold, Eye, Heading2, Italic, Link2, List, Pencil, Plus, Quote, Trash2, X } from 'lucide-react';
import { defaultsFor, emptyValue, slugify, type FieldDef } from '@ngo/shared';
import { get } from '@/lib/api';
import { cn } from '@/lib/cn';
import { Markdown } from '@/components/site/Markdown';
import { MediaField } from './media';

type Values = Record<string, unknown>;

/** Errors keyed by dotted path, e.g. "ctas.0.href". */
export type FieldErrors = Record<string, string>;

export function FieldForm({ fields, value, onChange, errors = {}, pathPrefix = '', groups = true }: { fields: FieldDef[]; value: Values; onChange: (v: Values) => void; errors?: FieldErrors; pathPrefix?: string; groups?: boolean }) {
  const set = (name: string, v: unknown) => onChange({ ...value, [name]: v });
  const groupNames = groups ? Array.from(new Set(fields.map((f) => f.group ?? 'Details'))) : ['Details'];
  const [tab, setTab] = useState(groupNames[0]);
  const visible = groupNames.length > 1 ? fields.filter((f) => (f.group ?? 'Details') === tab) : fields;
  return (
    <div>
      {groupNames.length > 1 && (
        <div role="tablist" className="mb-5 flex flex-wrap gap-1 rounded-xl bg-surface-alt p-1">
          {groupNames.map((g) => {
            const hasError = fields.some((f) => (f.group ?? 'Details') === g && Object.keys(errors).some((k) => k === pathPrefix + f.name || k.startsWith(`${pathPrefix}${f.name}.`)));
            return (
              <button key={g} type="button" role="tab" aria-selected={tab === g} onClick={() => setTab(g)} className={cn('relative rounded-lg px-3 py-1.5 text-sm font-medium', tab === g ? 'bg-surface shadow-sm' : 'text-ink-muted hover:text-ink')}>
                {g}
                {hasError && <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-red-600" aria-label="has errors" />}
              </button>
            );
          })}
        </div>
      )}
      <div className="space-y-5">
        {visible.map((f) => (
          <FieldControl key={f.name} field={f} value={value[f.name]} onChange={(v) => set(f.name, v)} errors={errors} path={pathPrefix + f.name} siblings={value} />
        ))}
      </div>
    </div>
  );
}

function Label({ field, htmlFor, children }: { field: FieldDef; htmlFor?: string; children?: ReactNode }) {
  return (
    <div className="mb-1.5 flex items-center justify-between gap-3">
      <label htmlFor={htmlFor} className="text-sm font-medium">
        {field.label}
        {field.required && <span className="ml-0.5 text-red-700" aria-hidden>*</span>}
      </label>
      {children}
    </div>
  );
}

function FieldControl({ field: f, value, onChange, errors, path, siblings }: { field: FieldDef; value: unknown; onChange: (v: unknown) => void; errors: FieldErrors; path: string; siblings: Values }) {
  const id = `f-${path.replace(/\./g, '-')}`;
  const error = errors[path];
  const describedBy = error ? `${id}-err` : f.help ? `${id}-help` : undefined;
  const common = { id, 'aria-invalid': Boolean(error) || undefined, 'aria-describedby': describedBy };
  let control: ReactNode;

  switch (f.type) {
    case 'text':
    case 'email':
    case 'link':
      control = <input {...common} type={f.type === 'email' ? 'email' : 'text'} className="admin-input" value={String(value ?? '')} maxLength={f.max} placeholder={f.placeholder ?? (f.type === 'link' ? '/donate or https://…' : '')} onChange={(e) => onChange(e.target.value)} />;
      break;
    case 'slug':
      control = (
        <div className="flex gap-2">
          <input {...common} className="admin-input font-mono" value={String(value ?? '')} onChange={(e) => onChange(slugify(e.target.value))} />
          {typeof siblings.title === 'string' && (
            <button type="button" className="btn btn-outline btn-sm shrink-0" onClick={() => onChange(slugify(String(siblings.title || siblings.name || '')))}>From title</button>
          )}
        </div>
      );
      break;
    case 'textarea':
      control = <textarea {...common} className="admin-input min-h-[90px]" value={String(value ?? '')} maxLength={f.max} onChange={(e) => onChange(e.target.value)} />;
      break;
    case 'richtext':
      control = <MarkdownEditor id={id} value={String(value ?? '')} onChange={onChange} invalid={Boolean(error)} />;
      break;
    case 'number':
      control = <input {...common} type="number" className="admin-input" value={value === null || value === undefined ? '' : String(value)} min={f.min} max={f.max} onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))} />;
      break;
    case 'money':
      control = (
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-ink-muted">₹</span>
          <input {...common} type="number" step="1" min={0} className="admin-input pl-7" value={value === null || value === undefined ? '' : String(Number(value) / 100)} onChange={(e) => onChange(e.target.value === '' ? null : Math.round(Number(e.target.value) * 100))} />
        </div>
      );
      break;
    case 'boolean':
      return (
        <div>
          <label className="flex cursor-pointer items-start gap-3 text-sm">
            <input type="checkbox" className="mt-0.5 h-5 w-5 rounded accent-[rgb(var(--c-primary))]" checked={Boolean(value)} onChange={(e) => onChange(e.target.checked)} />
            <span>
              <span className="font-medium">{f.label}</span>
              {f.help && <span className="mt-0.5 block text-xs text-ink-muted">{f.help}</span>}
            </span>
          </label>
          {error && <p className="field-error">{error}</p>}
        </div>
      );
    case 'select':
      control = (
        <select {...common} className="admin-input" value={String(value ?? f.options?.[0]?.value ?? '')} onChange={(e) => onChange(e.target.value)}>
          {f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      );
      break;
    case 'date':
      control = <input {...common} type="date" className="admin-input" value={value ? String(value).slice(0, 10) : ''} onChange={(e) => onChange(e.target.value || null)} />;
      break;
    case 'datetime':
      control = <input {...common} type="datetime-local" className="admin-input" value={value ? toLocalInput(String(value)) : ''} onChange={(e) => onChange(e.target.value ? new Date(e.target.value).toISOString() : null)} />;
      break;
    case 'image':
    case 'file':
      control = <MediaField value={String(value ?? '')} onChange={onChange} kind={f.type === 'file' ? 'DOCUMENT' : 'IMAGE'} />;
      break;
    case 'images':
      control = <ImagesField value={Array.isArray(value) ? (value as string[]) : []} onChange={onChange} max={f.maxItems} />;
      break;
    case 'list':
      control = <ListField id={id} value={Array.isArray(value) ? (value as string[]) : []} onChange={onChange} max={f.maxItems} />;
      break;
    case 'relation':
      control = <RelationField {...common} collection={f.relation!} value={(value as string | null) ?? ''} onChange={(v) => onChange(v || null)} />;
      break;
    case 'repeater':
      control = <RepeaterField field={f} value={Array.isArray(value) ? (value as Values[]) : []} onChange={onChange} errors={errors} path={path} />;
      break;
  }
  return (
    <div>
      <Label field={f} htmlFor={['repeater', 'images', 'image', 'file'].includes(f.type) ? undefined : id} />
      {control}
      {f.help && !error && <p id={`${id}-help`} className="field-help">{f.help}</p>}
      {error && <p id={`${id}-err`} className="field-error" role="alert">{error}</p>}
    </div>
  );
}

function toLocalInput(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const off = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - off).toISOString().slice(0, 16);
}

function RelationField({ collection, value, onChange, ...rest }: { collection: string; value: string; onChange: (v: string) => void; id: string }) {
  const { data } = useQuery({ queryKey: ['admin', 'options', collection], queryFn: () => get<{ id: string; label: string; status: string }[]>(`/admin/collections/${collection}/options`), staleTime: 30_000 });
  return (
    <select {...rest} className="admin-input" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">— None —</option>
      {data?.map((o) => <option key={o.id} value={o.id}>{o.label}{o.status !== 'PUBLISHED' && o.status !== 'ACTIVE' && o.status !== 'OPEN' ? ` (${o.status.toLowerCase()})` : ''}</option>)}
    </select>
  );
}

function ListField({ id, value, onChange, max = 30 }: { id: string; value: string[]; onChange: (v: string[]) => void; max?: number }) {
  const [draft, setDraft] = useState('');
  const add = () => {
    const v = draft.trim();
    if (v && value.length < max) onChange([...value, v]);
    setDraft('');
  };
  return (
    <div className="rounded-lg border border-line bg-surface p-2">
      {value.length > 0 && (
        <ul className="mb-2 space-y-1">
          {value.map((item, i) => (
            <li key={`${item}-${i}`} className="flex items-center gap-2 rounded-md bg-surface-alt px-2 py-1 text-sm">
              <input className="min-w-0 flex-1 bg-transparent outline-none" value={item} onChange={(e) => onChange(value.map((x, n) => (n === i ? e.target.value : x)))} aria-label={`Item ${i + 1}`} />
              <button type="button" disabled={i === 0} onClick={() => onChange(move(value, i, -1))} aria-label="Move up" className="p-1 text-ink-muted disabled:opacity-30"><ArrowUp className="h-3.5 w-3.5" /></button>
              <button type="button" disabled={i === value.length - 1} onClick={() => onChange(move(value, i, 1))} aria-label="Move down" className="p-1 text-ink-muted disabled:opacity-30"><ArrowDown className="h-3.5 w-3.5" /></button>
              <button type="button" onClick={() => onChange(value.filter((_, n) => n !== i))} aria-label="Remove" className="p-1 text-ink-muted hover:text-red-700"><X className="h-3.5 w-3.5" /></button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2">
        <input id={id} className="admin-input" placeholder="Type and press Enter" value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }} />
        <button type="button" className="btn btn-outline btn-sm" onClick={add} disabled={value.length >= max}>Add</button>
      </div>
    </div>
  );
}

function ImagesField({ value, onChange, max = 40 }: { value: string[]; onChange: (v: string[]) => void; max?: number }) {
  return (
    <div className="space-y-2">
      {value.map((url, i) => (
        <div key={`${url}-${i}`} className="flex items-center gap-2 rounded-xl border border-line p-2">
          <div className="flex-1"><MediaField compact value={url} onChange={(v) => (v ? onChange(value.map((x, n) => (n === i ? v : x))) : onChange(value.filter((_, n) => n !== i)))} /></div>
          <button type="button" disabled={i === 0} onClick={() => onChange(move(value, i, -1))} aria-label="Move up" className="p-1.5 text-ink-muted disabled:opacity-30"><ArrowUp className="h-4 w-4" /></button>
          <button type="button" disabled={i === value.length - 1} onClick={() => onChange(move(value, i, 1))} aria-label="Move down" className="p-1.5 text-ink-muted disabled:opacity-30"><ArrowDown className="h-4 w-4" /></button>
        </div>
      ))}
      {value.length < max && <AddImage onAdd={(u) => onChange([...value, u])} />}
    </div>
  );
}

function AddImage({ onAdd }: { onAdd: (url: string) => void }) {
  const [v, setV] = useState('');
  return (
    <div className="rounded-xl border border-dashed border-line p-2">
      <MediaField compact value={v} onChange={(u) => { if (u) { onAdd(u); setV(''); } }} />
    </div>
  );
}

function RepeaterField({ field, value, onChange, errors, path }: { field: FieldDef; value: Values[]; onChange: (v: Values[]) => void; errors: FieldErrors; path: string }) {
  const [open, setOpen] = useState<number | null>(value.length ? null : null);
  const sub = field.fields ?? [];
  const titleOf = (row: Values, i: number) => String(row[sub[0]?.name] || row.title || row.label || `Item ${i + 1}`);
  return (
    <div className="space-y-2">
      {value.map((row, i) => {
        const rowHasError = Object.keys(errors).some((k) => k.startsWith(`${path}.${i}.`));
        return (
          <div key={i} className={cn('rounded-xl border bg-surface', rowHasError ? 'border-red-400' : 'border-line')}>
            <div className="flex items-center gap-1 px-3 py-2">
              <button type="button" className="flex min-w-0 flex-1 items-center gap-2 text-left text-sm font-medium" onClick={() => setOpen(open === i ? null : i)} aria-expanded={open === i}>
                <Pencil className="h-3.5 w-3.5 shrink-0 text-ink-muted" aria-hidden />
                <span className="truncate">{titleOf(row, i)}</span>
              </button>
              <button type="button" disabled={i === 0} onClick={() => onChange(move(value, i, -1))} aria-label="Move up" className="p-1.5 text-ink-muted disabled:opacity-30"><ArrowUp className="h-4 w-4" /></button>
              <button type="button" disabled={i === value.length - 1} onClick={() => onChange(move(value, i, 1))} aria-label="Move down" className="p-1.5 text-ink-muted disabled:opacity-30"><ArrowDown className="h-4 w-4" /></button>
              <button type="button" onClick={() => onChange(value.filter((_, n) => n !== i))} aria-label="Remove item" className="p-1.5 text-ink-muted hover:text-red-700"><Trash2 className="h-4 w-4" /></button>
            </div>
            {(open === i || rowHasError) && (
              <div className="border-t border-line p-3">
                <FieldForm fields={sub} value={row} onChange={(r) => onChange(value.map((x, n) => (n === i ? r : x)))} errors={errors} pathPrefix={`${path}.${i}.`} groups={false} />
              </div>
            )}
          </div>
        );
      })}
      {value.length < (field.maxItems ?? 30) && (
        <button type="button" className="btn btn-outline btn-sm" onClick={() => { onChange([...value, defaultsFor(sub)]); setOpen(value.length); }}>
          <Plus className="h-4 w-4" aria-hidden /> Add {field.label.toLowerCase().replace(/s$/, '')}
        </button>
      )}
    </div>
  );
}

function move<T>(arr: T[], i: number, d: number): T[] {
  const next = [...arr];
  const j = i + d;
  if (j < 0 || j >= arr.length) return arr;
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

/** Lightweight markdown editor with formatting toolbar and preview. */
export function MarkdownEditor({ id, value, onChange, invalid }: { id: string; value: string; onChange: (v: string) => void; invalid?: boolean }) {
  const [preview, setPreview] = useState(false);
  const wrap = (before: string, after = before, placeholder = 'text') => {
    const el = document.getElementById(id) as HTMLTextAreaElement | null;
    if (!el) return;
    const { selectionStart: s, selectionEnd: e } = el;
    const selected = value.slice(s, e) || placeholder;
    const next = value.slice(0, s) + before + selected + after + value.slice(e);
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(s + before.length, s + before.length + selected.length);
    });
  };
  const line = (prefix: string) => {
    const el = document.getElementById(id) as HTMLTextAreaElement | null;
    const s = el?.selectionStart ?? value.length;
    const start = value.lastIndexOf('\n', s - 1) + 1;
    onChange(value.slice(0, start) + prefix + value.slice(start));
  };
  const tools: { icon: typeof Bold; label: string; run: () => void }[] = [
    { icon: Heading2, label: 'Heading', run: () => line('## ') },
    { icon: Bold, label: 'Bold', run: () => wrap('**') },
    { icon: Italic, label: 'Italic', run: () => wrap('*') },
    { icon: Link2, label: 'Link', run: () => wrap('[', '](https://)', 'link text') },
    { icon: List, label: 'Bullet list', run: () => line('- ') },
    { icon: Quote, label: 'Quote', run: () => line('> ') },
  ];
  return (
    <div className={cn('overflow-hidden rounded-lg border bg-surface', invalid ? 'border-red-500' : 'border-line')}>
      <div className="flex items-center gap-0.5 border-b border-line bg-surface-alt/60 px-1.5 py-1">
        {tools.map((t) => (
          <button key={t.label} type="button" onClick={t.run} disabled={preview} className="rounded p-1.5 text-ink-muted hover:bg-surface hover:text-ink disabled:opacity-40" aria-label={t.label} title={t.label}>
            <t.icon className="h-4 w-4" />
          </button>
        ))}
        <button type="button" onClick={() => setPreview((p) => !p)} className={cn('ml-auto flex items-center gap-1 rounded px-2 py-1 text-xs font-medium', preview ? 'bg-primary text-primary-contrast' : 'text-ink-muted hover:bg-surface')}>
          <Eye className="h-3.5 w-3.5" /> {preview ? 'Editing off' : 'Preview'}
        </button>
      </div>
      {preview ? (
        <div className="max-h-[420px] overflow-y-auto p-4"><Markdown className="prose-base">{value || '*Nothing to preview*'}</Markdown></div>
      ) : (
        <textarea id={id} className="block min-h-[180px] w-full resize-y bg-transparent p-3 font-mono text-sm outline-none" value={value} onChange={(e) => onChange(e.target.value)} />
      )}
    </div>
  );
}

/** Ensures every field has a value (used when opening older records). */
export function withDefaults(fields: FieldDef[], value: Values): Values {
  const out: Values = { ...value };
  for (const f of fields) if (out[f.name] === undefined) out[f.name] = emptyValue(f);
  return out;
}
