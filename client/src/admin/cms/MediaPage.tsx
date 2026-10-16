import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Copy, ImagePlus, Loader2, RefreshCw, Trash2 } from 'lucide-react';
import { useAuth } from '@/app/AuthProvider';
import { api, ApiError, get, send } from '@/lib/api';
import { cn } from '@/lib/cn';
import { dateTime } from '@/lib/format';
import { Button, EmptyState, Modal, Pagination, useConfirm, useToast } from '@/components/ui';
import { AdminPage, AdminSelect, DetailList, FilterBar, SearchInput } from '../ui';
import { MediaThumb, UploadDrop, fileSize, useMedia, useUpload, type MediaAsset } from './media';

export default function MediaPage() {
  const [q, setQ] = useState('');
  const [kind, setKind] = useState('');
  const [folder, setFolder] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<MediaAsset | null>(null);
  const { data, isLoading } = useMedia({ q, kind, folder, page, limit: 40 });
  const { upload, busy } = useUpload();
  const { can } = useAuth();
  const [uploadFolder, setUploadFolder] = useState('general');

  return (
    <AdminPage title="Media library" description="Upload, organise and replace images, videos and documents used across the website. Images are resized and converted to WebP, and location metadata is stripped.">
      {can('media.manage', 'website.pages', 'content.manage') && (
        <div className="mb-6 grid gap-3 sm:grid-cols-[1fr_220px]">
          <UploadDrop busy={busy} onFiles={(f) => upload(f, uploadFolder)} />
          <label className="admin-card">
            <span className="admin-label">Upload to folder</span>
            <input className="admin-input" value={uploadFolder} onChange={(e) => setUploadFolder(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))} />
            <span className="field-help">e.g. campaigns, team, events</span>
          </label>
        </div>
      )}
      <FilterBar>
        <SearchInput value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Search by name, alt text or caption" />
        <AdminSelect label="Type" value={kind} onChange={(v) => { setKind(v); setPage(1); }} options={[{ value: '', label: 'All types' }, { value: 'IMAGE', label: 'Images' }, { value: 'VIDEO', label: 'Videos' }, { value: 'DOCUMENT', label: 'Documents' }]} />
        <AdminSelect label="Folder" value={folder} onChange={(v) => { setFolder(v); setPage(1); }} options={[{ value: '', label: 'All folders' }, ...(data?.meta.folders ?? []).map((f) => ({ value: f.name, label: `${f.name} (${f.count})` }))]} />
      </FilterBar>
      {isLoading ? (
        <div className="grid place-items-center py-24"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : !data?.data.length ? (
        <EmptyState icon={ImagePlus} title="No media found">Upload images, videos or PDFs above.</EmptyState>
      ) : (
        <>
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {data.data.map((a) => (
              <li key={a.id}>
                <button onClick={() => setSelected(a)} className="group block w-full overflow-hidden rounded-xl border border-line bg-surface text-left transition hover:border-primary">
                  <div className="aspect-square overflow-hidden"><MediaThumb asset={a} className="transition duration-500 group-hover:scale-105" /></div>
                  <div className="px-2.5 py-2">
                    <p className="truncate text-xs font-medium">{a.filename}</p>
                    <p className={cn('text-[11px]', a.alt || a.kind !== 'IMAGE' ? 'text-ink-muted' : 'text-amber-700')}>{a.kind === 'IMAGE' && !a.alt ? 'Missing alt text' : `${a.width ? `${a.width}×${a.height} · ` : ''}${fileSize(a.size)}`}</p>
                  </div>
                </button>
              </li>
            ))}
          </ul>
          <Pagination page={page} pages={data.meta.pages} onChange={setPage} />
        </>
      )}
      <AssetDialog asset={selected} onClose={() => setSelected(null)} />
    </AdminPage>
  );
}

function AssetDialog({ asset, onClose }: { asset: MediaAsset | null; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();
  const { can } = useAuth();
  const [form, setForm] = useState({ alt: '', caption: '', folder: '' });
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (asset) setForm({ alt: asset.alt, caption: asset.caption, folder: asset.folder });
  }, [asset]);
  const usage = useQuery({ queryKey: ['admin', 'media-usage', asset?.id], queryFn: () => get<{ table: string; id: string; label: string }[]>(`/admin/media/${asset!.id}/usage`), enabled: Boolean(asset) });
  if (!asset) return null;
  const manage = can('media.manage');
  const refresh = () => qc.invalidateQueries({ queryKey: ['admin', 'media'] });
  const absolute = asset.url.startsWith('http') ? asset.url : `${window.location.origin}${asset.url}`;

  return (
    <Modal open onClose={onClose} title={asset.filename} size="lg" footer={manage ? (
      <>
        <Button variant="danger" size="sm" icon={Trash2} disabled={busy} onClick={async () => {
          const used = usage.data?.length ?? 0;
          const ok = await confirm({ title: 'Delete this file?', danger: true, confirmLabel: 'Delete permanently', message: used ? `It is used in ${used} place(s). Those images will disappear from the website. Consider “Replace file” instead.` : 'The file will be permanently removed.', typeToConfirm: used ? 'DELETE' : undefined });
          if (!ok) return;
          try {
            await api(`/admin/media/${asset.id}`, { method: 'DELETE', body: { confirm: true, force: used > 0 } });
            toast('File deleted');
            refresh();
            onClose();
          } catch (e) {
            toast(e instanceof ApiError ? e.message : 'Delete failed', 'error');
          }
        }}>Delete</Button>
        <Button variant="outline" size="sm" icon={RefreshCw} loading={busy} onClick={() => fileRef.current?.click()}>Replace file</Button>
        <Button size="sm" disabled={busy} onClick={async () => {
          try {
            await send(`/admin/media/${asset.id}`, form, 'PUT');
            toast('Saved');
            refresh();
            onClose();
          } catch (e) {
            toast(e instanceof ApiError ? e.message : 'Save failed', 'error');
          }
        }}>Save details</Button>
        <input ref={fileRef} type="file" className="hidden" onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          const fd = new FormData();
          fd.append('file', f);
          setBusy(true);
          try {
            const r = await api<{ data: { referencesUpdated: number } }>(`/admin/media/${asset.id}/replace`, { form: fd });
            toast(`File replaced · ${r.data.referencesUpdated} reference(s) updated`);
            refresh();
            onClose();
          } catch (err) {
            toast(err instanceof ApiError ? err.message : 'Replace failed', 'error');
          } finally {
            setBusy(false);
          }
        }} />
      </>
    ) : undefined}>
      <div className="grid gap-6 md:grid-cols-2">
        <div className="overflow-hidden rounded-xl border border-line bg-surface-alt">
          {asset.kind === 'IMAGE' ? <img src={asset.url} alt={asset.alt} className="max-h-[360px] w-full object-contain" /> : asset.kind === 'VIDEO' ? <video src={asset.url} controls className="w-full" /> : <div className="aspect-video"><MediaThumb asset={asset} /></div>}
        </div>
        <div className="space-y-4">
          <DetailList items={[['Type', asset.mimeType], ['Size', fileSize(asset.size)], ['Dimensions', asset.width ? `${asset.width} × ${asset.height}px` : ''], ['Uploaded', dateTime(asset.createdAt)]]} />
          <div className="flex gap-2">
            <input readOnly className="admin-input text-xs" value={absolute} aria-label="File URL" />
            <button className="btn btn-outline btn-sm" onClick={() => navigator.clipboard.writeText(absolute).then(() => toast('URL copied'))} aria-label="Copy URL"><Copy className="h-4 w-4" /></button>
          </div>
          <label className="block"><span className="admin-label">Alt text (describes the image for screen readers & SEO)</span><input className="admin-input" disabled={!manage} value={form.alt} maxLength={200} onChange={(e) => setForm({ ...form, alt: e.target.value })} /></label>
          <label className="block"><span className="admin-label">Caption</span><input className="admin-input" disabled={!manage} value={form.caption} maxLength={300} onChange={(e) => setForm({ ...form, caption: e.target.value })} /></label>
          <label className="block"><span className="admin-label">Folder</span><input className="admin-input" disabled={!manage} value={form.folder} onChange={(e) => setForm({ ...form, folder: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })} /></label>
          <div>
            <p className="admin-label">Used in</p>
            {usage.isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : usage.data?.length ? (
              <ul className="space-y-1 text-sm">{usage.data.map((u) => <li key={`${u.table}-${u.id}`} className="flex gap-2"><span className="chip">{u.table}</span><span className="truncate">{u.label}</span></li>)}</ul>
            ) : <p className="text-sm text-ink-muted">Not used anywhere — safe to delete.</p>}
          </div>
        </div>
      </div>
    </Modal>
  );
}
