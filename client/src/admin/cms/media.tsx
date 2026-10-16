import { useRef, useState, type ReactNode } from 'react';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { FileText, Film, ImagePlus, Loader2, Search, Upload } from 'lucide-react';
import { api, ApiError, qs } from '@/lib/api';
import { cn } from '@/lib/cn';
import { sized } from '@/lib/image';
import { Button, EmptyState, Modal, Pagination, useToast } from '@/components/ui';

export interface MediaAsset {
  id: string; kind: 'IMAGE' | 'VIDEO' | 'DOCUMENT'; url: string; variants: Record<string, string>; folder: string; filename: string; mimeType: string; size: number; width: number | null; height: number | null; alt: string; caption: string; createdAt: string;
}
export const fileSize = (n: number) => (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

export function useMedia(params: { q?: string; kind?: string; folder?: string; page?: number; limit?: number }) {
  return useQuery({
    queryKey: ['admin', 'media', params],
    queryFn: () => api<{ data: MediaAsset[]; meta: { page: number; pages: number; total: number; folders: { name: string; count: number }[] } }>(`/admin/media${qs(params)}`),
    placeholderData: keepPreviousData,
  });
}

export function useUpload() {
  const qc = useQueryClient();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const upload = async (files: FileList | File[], folder = 'general'): Promise<MediaAsset[]> => {
    const fd = new FormData();
    Array.from(files).forEach((f) => fd.append('files', f));
    fd.append('folder', folder);
    setBusy(true);
    try {
      const res = await api<{ data: MediaAsset[]; meta: { failed: { file: string; message: string }[] } }>('/admin/media', { form: fd });
      res.meta.failed.forEach((f) => toast(`${f.file}: ${f.message}`, 'error'));
      toast(`${res.data.length} file(s) uploaded and optimised`);
      qc.invalidateQueries({ queryKey: ['admin', 'media'] });
      return res.data;
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Upload failed', 'error');
      return [];
    } finally {
      setBusy(false);
    }
  };
  return { upload, busy };
}

export function MediaThumb({ asset, className }: { asset: MediaAsset; className?: string }) {
  if (asset.kind === 'IMAGE') return <img src={asset.variants['480'] ?? asset.url} alt={asset.alt} loading="lazy" className={cn('h-full w-full object-cover', className)} />;
  const Icon = asset.kind === 'VIDEO' ? Film : FileText;
  return <div className={cn('grid h-full w-full place-items-center bg-surface-alt text-ink-muted', className)}><Icon className="h-8 w-8" /><span className="sr-only">{asset.filename}</span></div>;
}

export function UploadDrop({ onFiles, busy, accept = 'image/*,video/mp4,video/webm,application/pdf', children }: { onFiles: (f: FileList) => void; busy: boolean; accept?: string; children?: ReactNode }) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); if (e.dataTransfer.files.length) onFiles(e.dataTransfer.files); }}
      className={cn('flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-4 py-6 text-center text-sm transition', over ? 'border-primary bg-primary/5' : 'border-line')}
    >
      {busy ? <Loader2 className="h-6 w-6 animate-spin text-primary" /> : <Upload className="h-6 w-6 text-ink-muted" aria-hidden />}
      <p className="text-ink-muted">{children ?? 'Drag & drop files here, or'}</p>
      <button type="button" className="btn btn-outline btn-sm" onClick={() => input.current?.click()} disabled={busy}>Choose files</button>
      <p className="text-xs text-ink-muted">JPG, PNG, WebP, AVIF, GIF, MP4, WebM or PDF. Images are converted to WebP automatically.</p>
      <input ref={input} type="file" multiple accept={accept} className="hidden" onChange={(e) => e.target.files?.length && onFiles(e.target.files)} />
    </div>
  );
}

/** Media picker dialog used by every image/file field. */
export function MediaPickerModal({ open, onClose, onSelect, kind = 'IMAGE' }: { open: boolean; onClose: () => void; onSelect: (a: MediaAsset) => void; kind?: 'IMAGE' | 'DOCUMENT' | 'VIDEO' | '' }) {
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const { data, isLoading } = useMedia({ q, kind: kind || undefined, page, limit: 24 });
  const { upload, busy } = useUpload();
  return (
    <Modal open={open} onClose={onClose} title="Choose from media library" size="xl">
      <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
        <div className="space-y-4">
          <UploadDrop busy={busy} accept={kind === 'DOCUMENT' ? 'application/pdf' : kind === 'IMAGE' ? 'image/*' : undefined} onFiles={async (f) => { const up = await upload(f, 'uploads'); if (up.length === 1) { onSelect(up[0]); onClose(); } }} />
          <label className="relative block">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" aria-hidden />
            <input className="admin-input pl-9" placeholder="Search files…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} aria-label="Search media" />
          </label>
        </div>
        <div>
          {isLoading ? (
            <div className="grid place-items-center py-20"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : !data?.data.length ? (
            <EmptyState icon={ImagePlus} title="No files yet">Upload your first file on the left.</EmptyState>
          ) : (
            <>
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                {data.data.map((a) => (
                  <li key={a.id}>
                    <button type="button" onClick={() => { onSelect(a); onClose(); }} className="group block w-full overflow-hidden rounded-xl border border-line text-left focus-visible:ring-4 focus-visible:ring-primary/30">
                      <div className="aspect-square overflow-hidden"><MediaThumb asset={a} className="transition group-hover:scale-105" /></div>
                      <p className="truncate px-2 py-1.5 text-xs text-ink-muted">{a.filename}</p>
                    </button>
                  </li>
                ))}
              </ul>
              <Pagination page={page} pages={data.meta.pages} onChange={setPage} />
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}

/** Image/file field: preview + choose/replace/remove + manual URL. */
export function MediaField({ value, onChange, kind = 'IMAGE', compact }: { value: string; onChange: (v: string) => void; kind?: 'IMAGE' | 'DOCUMENT'; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={cn('flex gap-3', compact ? 'items-center' : 'flex-col sm:flex-row sm:items-start')}>
      <div className={cn('shrink-0 overflow-hidden rounded-xl border border-line bg-surface-alt', compact ? 'h-14 w-14' : 'aspect-video w-full sm:w-44')}>
        {value ? (
          kind === 'IMAGE' ? <img src={sized(value, 400)} alt="" className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center text-ink-muted"><FileText className="h-6 w-6" /></div>
        ) : (
          <div className="grid h-full place-items-center text-ink-muted"><ImagePlus className="h-6 w-6" aria-hidden /></div>
        )}
      </div>
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)}>{value ? 'Replace' : 'Choose'}</Button>
          {value && <Button type="button" size="sm" variant="ghost" onClick={() => onChange('')}>Remove</Button>}
        </div>
        {!compact && <input className="admin-input text-xs" placeholder="…or paste an https:// URL" value={value} onChange={(e) => onChange(e.target.value)} aria-label="Media URL" />}
      </div>
      <MediaPickerModal open={open} onClose={() => setOpen(false)} onSelect={(a) => onChange(a.url)} kind={kind} />
    </div>
  );
}
