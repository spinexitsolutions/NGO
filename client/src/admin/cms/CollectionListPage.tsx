import { useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Copy, ExternalLink, Plus, Trash2, Users } from 'lucide-react';
import { COLLECTION_MAP, COLLECTIONS, type CollectionDef } from '@ngo/shared';
import { useAuth } from '@/app/AuthProvider';
import { ApiError, api } from '@/lib/api';
import { date, money } from '@/lib/format';
import { Badge, ButtonLink, EmptyState, StatusBadge, useConfirm, useToast } from '@/components/ui';
import { AdminPage, AdminSelect, DataTable, ExportButton, FilterBar, ListFooter, QueryError, SearchInput, useAdminList, type Column } from '../ui';

const FAMILIES = [
  ['causes', 'stories', 'team', 'partners', 'testimonials', 'impactStats', 'faqs', 'documents', 'galleryAlbums', 'jobs', 'posts', 'categories'],
  ['campaigns', 'campaignUpdates'],
  ['projects', 'projectReports'],
];

type Row = Record<string, unknown> & { id: string; status: string; isSample?: boolean };

function cell(def: CollectionDef, key: string, row: Row) {
  const f = def.fields.find((x) => x.name === key);
  const v = row[key];
  if (key === 'status') return <StatusBadge status={String(v)} />;
  if (key === 'updatedAt' || f?.type === 'date' || f?.type === 'datetime') return <span className="whitespace-nowrap text-ink-muted">{date(v as string)}</span>;
  if (f?.type === 'money') return money(v as number);
  if (f?.type === 'boolean') return v ? <Badge tone="green">Yes</Badge> : <span className="text-ink-muted">—</span>;
  if (f?.type === 'relation') return v ? <span className="text-ink-muted">linked</span> : <span className="text-ink-muted">—</span>;
  if (f?.type === 'select') return <span className="capitalize">{String(v ?? '').toLowerCase().replace(/_/g, ' ')}</span>;
  return <span className="line-clamp-1">{String(v ?? '')}</span>;
}

export default function CollectionListPage() {
  const { collection = '' } = useParams();
  const def = COLLECTION_MAP[collection];
  const { can } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const list = useAdminList<Row>(`/admin/collections/${collection}`, { q, status, limit: 25 }, 'collection');
  if (!def) return <Navigate to="/admin" replace />;

  const family = FAMILIES.find((f) => f.includes(collection)) ?? [collection];
  const siblings = COLLECTIONS.filter((c) => family.includes(c.key) && can(c.permission));
  const columns: Column<Row>[] = [
    ...def.listColumns.map((k, i) => ({
      key: k,
      header: k === 'updatedAt' ? 'Updated' : def.fields.find((f) => f.name === k)?.label ?? (k === 'status' ? 'Status' : k),
      render: (r: Row) => (i === 0 ? <span className="flex items-center gap-2">{cell(def, k, r)} {r.isSample && <Badge tone="amber">Sample</Badge>}</span> : cell(def, k, r)),
    })),
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      className: 'text-right',
      render: (r: Row) => (
        <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          {collection === 'events' && <Link to={`/admin/events/${r.id}/registrations`} className="rounded-lg p-2 text-ink-muted hover:bg-ink/5 hover:text-ink" aria-label="Registrations" title="Registrations"><Users className="h-4 w-4" /></Link>}
          {def.publicPath && def.hasSlug && def.publicStatuses.includes(r.status) && (
            <a href={`${def.publicPath}/${r.slug}`} target="_blank" rel="noopener" className="rounded-lg p-2 text-ink-muted hover:bg-ink/5 hover:text-ink" aria-label="View on site" title="View on site"><ExternalLink className="h-4 w-4" /></a>
          )}
          <button className="rounded-lg p-2 text-ink-muted hover:bg-ink/5 hover:text-ink" aria-label="Duplicate" title="Duplicate" onClick={async () => {
            const res = await api<{ data: Row }>(`/admin/collections/${collection}/${r.id}/duplicate`, { method: 'POST', body: {} });
            toast('Duplicated as a draft');
            navigate(`/admin/content/${collection}/${res.data.id}`);
          }}><Copy className="h-4 w-4" /></button>
          <button className="rounded-lg p-2 text-ink-muted hover:bg-red-50 hover:text-red-700" aria-label="Delete" title="Delete" onClick={async () => {
            if (!(await confirm({ title: `Delete this ${def.singular.toLowerCase()}?`, message: 'This cannot be undone. Consider archiving instead to keep history.', confirmLabel: 'Delete', danger: true }))) return;
            try {
              await api(`/admin/collections/${collection}/${r.id}`, { method: 'DELETE', body: { confirm: true } });
              toast('Deleted');
              qc.invalidateQueries({ queryKey: ['admin', 'collection'] });
            } catch (e) {
              toast(e instanceof ApiError ? e.message : 'Delete failed', 'error');
            }
          }}><Trash2 className="h-4 w-4" /></button>
        </div>
      ),
    },
  ];

  return (
    <AdminPage title={def.label} description={def.description} actions={<><ExportButton path={`/admin/collections/${collection}?format=csv`} filename={`${collection}.csv`} /><ButtonLink href={`/admin/content/${collection}/new`} size="sm" icon={Plus}>New {def.singular.toLowerCase()}</ButtonLink></>}>
      {siblings.length > 1 && (
        <nav aria-label="Content types" className="no-scrollbar mb-5 flex gap-1 overflow-x-auto border-b border-line">
          {siblings.map((c) => (
            <Link key={c.key} to={`/admin/content/${c.key}`} className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium ${c.key === collection ? 'border-primary text-primary' : 'border-transparent text-ink-muted hover:text-ink'}`}>{c.label}</Link>
          ))}
        </nav>
      )}
      <FilterBar>
        <SearchInput value={q} onChange={(v) => { setQ(v); list.setPage(1); }} />
        <AdminSelect label="Status" value={status} onChange={(v) => { setStatus(v); list.setPage(1); }} options={[{ value: '', label: 'All statuses' }, ...def.statusOptions.map((s) => ({ value: s.value, label: s.label }))]} />
      </FilterBar>
      {list.error ? (
        <QueryError error={list.error} retry={list.refetch} />
      ) : (
        <DataTable rows={list.rows} columns={columns} loading={list.isLoading} rowHref={(r) => `/admin/content/${collection}/${r.id}`} onRowClick={(r) => navigate(`/admin/content/${collection}/${r.id}`)}
          empty={<EmptyState title={`No ${def.label.toLowerCase()} yet`} action={<ButtonLink href={`/admin/content/${collection}/new`} size="sm" icon={Plus}>Create the first one</ButtonLink>}>{def.description}</EmptyState>} />
      )}
      <ListFooter meta={list.meta} setPage={list.setPage} />
    </AdminPage>
  );
}
