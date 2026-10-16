import { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, CloudUpload, History, Loader2, Monitor, RotateCcw, Smartphone, Tablet, Undo2 } from 'lucide-react';
import type { ZodTypeAny } from 'zod';
import { zodIssues } from '@ngo/shared';
import { ApiError, get, send } from '@/lib/api';
import { cn } from '@/lib/cn';
import { dateTime } from '@/lib/format';
import { Button, Modal, useConfirm, useToast } from '@/components/ui';

export type ConfigKey = 'theme' | 'settings' | 'navigation';
interface ConfigState<T> { draft: T; published: T; version: number; draftUpdatedAt: string; publishedAt: string; hasUnpublishedChanges: boolean; defaults: T }

/**
 * Draft/publish editor for theme, settings and navigation. Edits autosave to the server draft;
 * the live site only changes on Publish.
 */
export function useConfigEditor<T extends Record<string, unknown>>(key: ConfigKey, schema: ZodTypeAny) {
  const qc = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();
  const query = useQuery({ queryKey: ['admin', 'config', key], queryFn: () => get<ConfigState<T>>(`/admin/config/${key}`) });
  const [value, setValueState] = useState<T | null>(null);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error' | 'dirty'>('idle');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [unpublished, setUnpublished] = useState(false);
  const timer = useRef<number>();
  const latest = useRef<T | null>(null);

  useEffect(() => {
    if (query.data && !value) {
      setValueState(query.data.draft);
      setUnpublished(query.data.hasUnpublishedChanges);
    }
  }, [query.data, value]);

  const saveDraft = useCallback(
    async (v: T) => {
      const r = schema.safeParse(v);
      if (!r.success) {
        setErrors(Object.fromEntries(zodIssues(r.error).map((i) => [i.path, i.message])));
        setStatus('error');
        return false;
      }
      setErrors({});
      setStatus('saving');
      try {
        const res = await send<ConfigState<T>>(`/admin/config/${key}/draft`, r.data, 'PUT');
        setUnpublished(res.hasUnpublishedChanges);
        setStatus('saved');
        return true;
      } catch (e) {
        setStatus('error');
        if (e instanceof ApiError) setErrors(e.fieldErrors);
        toast(e instanceof ApiError ? e.message : 'Could not save draft', 'error');
        return false;
      }
    },
    [key, schema, toast],
  );

  const setValue = useCallback(
    (v: T) => {
      setValueState(v);
      latest.current = v;
      setStatus('dirty');
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => latest.current && saveDraft(latest.current), 1200);
    },
    [saveDraft],
  );

  const replaceFromServer = (s: ConfigState<T>) => {
    setValueState(s.draft);
    setUnpublished(s.hasUnpublishedChanges);
    setStatus('saved');
    qc.setQueryData(['admin', 'config', key], (old: ConfigState<T> | undefined) => (old ? { ...old, ...s } : old));
  };

  const publish = async () => {
    if (!value) return;
    window.clearTimeout(timer.current);
    if (!(await saveDraft(value))) return toast('Fix the highlighted fields before publishing', 'error');
    try {
      const s = await send<ConfigState<T>>(`/admin/config/${key}/publish`, { note: '' });
      replaceFromServer(s);
      qc.invalidateQueries({ queryKey: ['site'] });
      toast('Published — the live website is updated');
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Publish failed', 'error');
    }
  };

  const discard = async () => {
    if (!(await confirm({ title: 'Discard unpublished changes?', message: 'The draft will be reset to what is currently live.', danger: true, confirmLabel: 'Discard' }))) return;
    window.clearTimeout(timer.current);
    replaceFromServer(await send<ConfigState<T>>(`/admin/config/${key}/discard`));
    toast('Draft discarded');
  };

  const resetGroup = async (group?: string, label?: string) => {
    if (!(await confirm({ title: `Reset ${label ?? 'everything'} to defaults?`, message: 'This changes the draft only. You can review it, discard, or publish.', confirmLabel: 'Reset' }))) return;
    window.clearTimeout(timer.current);
    replaceFromServer(await send<ConfigState<T>>(`/admin/config/${key}/reset`, group ? { group } : {}));
    toast('Reset to defaults in draft');
  };

  return { query, value, setValue, status, errors, unpublished, publish, discard, resetGroup, replaceFromServer, saveNow: () => value && saveDraft(value) };
}

export function SaveStatus({ status, unpublished }: { status: string; unpublished: boolean }) {
  const text = { idle: unpublished ? 'Unpublished changes' : 'Up to date with live site', saving: 'Saving draft…', saved: unpublished ? 'Draft saved · not yet live' : 'Up to date with live site', error: 'Fix errors to save', dirty: 'Unsaved changes' }[status] ?? '';
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-xs font-medium', status === 'error' ? 'text-red-700' : unpublished || status === 'dirty' ? 'text-amber-700' : 'text-emerald-700')} role="status">
      {status === 'saving' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
      {text}
    </span>
  );
}

export function PublishBar({ editor, onHistory }: { editor: ReturnType<typeof useConfigEditor>; onHistory: () => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <SaveStatus status={editor.status} unpublished={editor.unpublished} />
      <Button variant="ghost" size="sm" icon={History} onClick={onHistory}>History</Button>
      <Button variant="outline" size="sm" icon={Undo2} disabled={!editor.unpublished} onClick={editor.discard}>Discard</Button>
      <Button variant="outline" size="sm" icon={RotateCcw} onClick={() => editor.resetGroup()}>Reset all</Button>
      <Button size="sm" icon={CloudUpload} loading={busy} disabled={editor.status === 'error'} onClick={async () => { setBusy(true); await editor.publish(); setBusy(false); }}>Publish</Button>
    </div>
  );
}

export function VersionHistory<T>({ configKey, open, onClose, onRestored }: { configKey: ConfigKey; open: boolean; onClose: () => void; onRestored: (s: ConfigState<T>) => void }) {
  const toast = useToast();
  const { data, isLoading } = useQuery({ queryKey: ['admin', 'config-versions', configKey], queryFn: () => get<{ id: string; version: number; note: string; createdAt: string }[]>(`/admin/config/${configKey}/versions`), enabled: open });
  return (
    <Modal open={open} onClose={onClose} title="Published versions">
      <p className="mb-4 text-sm text-ink-muted">Restoring copies a version into your draft so you can review it before publishing again.</p>
      {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : (
        <ul className="divide-y divide-line">
          {data?.map((v) => (
            <li key={v.id} className="flex items-center justify-between gap-4 py-3">
              <div><p className="font-medium">Version {v.version}</p><p className="text-xs text-ink-muted">{dateTime(v.createdAt)} {v.note && `· ${v.note}`}</p></div>
              <Button size="sm" variant="outline" onClick={async () => { onRestored(await send<ConfigState<T>>(`/admin/config/${configKey}/versions/${v.id}/restore`)); toast(`Version ${v.version} copied to draft`); onClose(); }}>Restore</Button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}

const DEVICES = { desktop: { w: '100%', icon: Monitor }, tablet: { w: '820px', icon: Tablet }, mobile: { w: '390px', icon: Smartphone } } as const;

/** Live preview: the real public site in an iframe, receiving the unpublished draft via postMessage. */
export function PreviewFrame({ payload, path = '/' }: { payload: Record<string, unknown>; path?: string }) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [device, setDevice] = useState<keyof typeof DEVICES>('desktop');
  const [url, setUrl] = useState(path);
  const post = useCallback(() => ref.current?.contentWindow?.postMessage({ type: 'ngo-preview', payload }, window.location.origin), [payload]);
  useEffect(() => { post(); }, [post]);
  useEffect(() => {
    const onMsg = (e: MessageEvent) => e.origin === window.location.origin && e.data?.type === 'ngo-preview-ready' && post();
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, [post]);
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-surface-alt">
      <div className="flex items-center gap-2 border-b border-line bg-surface px-3 py-2">
        <span className="hidden text-xs font-semibold uppercase tracking-wide text-ink-muted sm:inline">Live preview</span>
        <select className="admin-input ml-auto h-8 w-auto py-0 text-xs" value={url} onChange={(e) => setUrl(e.target.value)} aria-label="Preview page">
          {['/', '/about', '/donate', '/campaigns', '/causes', '/volunteer', '/contact'].map((p) => <option key={p} value={p}>{p === '/' ? 'Home' : p}</option>)}
        </select>
        {(Object.keys(DEVICES) as (keyof typeof DEVICES)[]).map((d) => {
          const I = DEVICES[d].icon;
          return <button key={d} onClick={() => setDevice(d)} aria-pressed={device === d} aria-label={`${d} preview`} className={cn('rounded-md p-1.5', device === d ? 'bg-primary text-primary-contrast' : 'text-ink-muted hover:bg-ink/5')}><I className="h-4 w-4" /></button>;
        })}
      </div>
      <div className="flex flex-1 justify-center overflow-auto p-3">
        <iframe ref={ref} key={url} src={url} title="Website preview" onLoad={post} className="h-full min-h-[600px] rounded-xl border border-line bg-white shadow-xl transition-[width] duration-300" style={{ width: DEVICES[device].w }} />
      </div>
    </div>
  );
}
