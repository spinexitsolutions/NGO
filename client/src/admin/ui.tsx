import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Download, Search, type LucideIcon } from 'lucide-react';
import { api, download, qs } from '@/lib/api';
import { cn } from '@/lib/cn';
import { EmptyState, ErrorState, Pagination, Skeleton, useToast } from '@/components/ui';

/** Page title bar used by every admin screen. */
export function AdminPage({ title, description, actions, children, back }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; children: ReactNode; back?: { href: string; label: string } }) {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-8 sm:py-8">
      {back && (
        <Link to={back.href} className="mb-3 inline-block text-sm text-ink-muted hover:text-ink">
          ← {back.label}
        </Link>
      )}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-heading text-3xl">{title}</h1>
          {description && <p className="mt-1 max-w-3xl text-sm text-ink-muted">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
      {children}
    </div>
  );
}

export function StatCard({ label, value, icon: Icon, hint, tone = 'default', href }: { label: string; value: ReactNode; icon?: LucideIcon; hint?: ReactNode; tone?: 'default' | 'green' | 'amber' | 'red'; href?: string }) {
  const tones = { default: 'bg-primary/10 text-primary', green: 'bg-emerald-100 text-emerald-700', amber: 'bg-amber-100 text-amber-700', red: 'bg-red-100 text-red-700' };
  const body = (
    <div className={cn('admin-card flex h-full items-start gap-4', href && 'transition hover:border-primary')}>
      {Icon && <span className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-xl', tones[tone])}><Icon className="h-5 w-5" aria-hidden /></span>}
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{label}</p>
        <p className="mt-1 truncate font-heading text-2xl">{value}</p>
        {hint && <p className="mt-0.5 text-xs text-ink-muted">{hint}</p>}
      </div>
    </div>
  );
  return href ? <Link to={href}>{body}</Link> : body;
}

export interface Column<T> {
  key: string;
  header: ReactNode;
  render: (row: T) => ReactNode;
  className?: string;
}

/** Responsive table: horizontal scroll on small screens, loading skeleton and empty state. */
export function DataTable<T extends { id: string }>({ rows, columns, loading, empty, onRowClick, rowHref }: { rows: T[] | undefined; columns: Column<T>[]; loading?: boolean; empty?: ReactNode; onRowClick?: (row: T) => void; rowHref?: (row: T) => string }) {
  if (loading)
    return (
      <div className="admin-card space-y-3">
        {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-9 w-full" />)}
      </div>
    );
  if (!rows?.length) return <>{empty ?? <EmptyState title="Nothing here yet" />}</>;
  return (
    <div className="admin-card overflow-x-auto p-0">
      <table className="table-base">
        <thead>
          <tr>{columns.map((c) => <th key={c.key} className={c.className}>{c.header}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className={cn((onRowClick || rowHref) && 'cursor-pointer')} onClick={() => onRowClick?.(r)}>
              {columns.map((c, i) => (
                <td key={c.key} className={c.className}>
                  {i === 0 && rowHref ? <Link to={rowHref(r)} className="font-medium text-ink hover:text-primary">{c.render(r)}</Link> : c.render(r)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export interface ListMeta { page: number; limit: number; total: number; pages: number; [k: string]: unknown }

/** Paginated admin list with filters held in state. */
export function useAdminList<T>(path: string, filters: Record<string, string | number | undefined>, key: string) {
  const [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: ['admin', key, path, filters, page],
    queryFn: () => api<{ data: T[]; meta: ListMeta }>(`${path}${qs({ ...filters, page })}`),
    placeholderData: keepPreviousData,
  });
  return { ...query, page, setPage, rows: query.data?.data, meta: query.data?.meta };
}

export function ListFooter({ meta, setPage }: { meta?: ListMeta; setPage: (p: number) => void }) {
  if (!meta) return null;
  return (
    <div className="mt-2 flex flex-col items-center justify-between gap-2 sm:flex-row">
      <p className="text-xs text-ink-muted">{meta.total.toLocaleString('en-IN')} total</p>
      <Pagination page={meta.page} pages={meta.pages} onChange={setPage} />
    </div>
  );
}

export function SearchInput({ value, onChange, placeholder = 'Search…' }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="relative block w-full sm:max-w-xs">
      <span className="sr-only">{placeholder}</span>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" aria-hidden />
      <input type="search" className="admin-input pl-9" placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

export function FilterBar({ children }: { children: ReactNode }) {
  return <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">{children}</div>;
}

export function ExportButton({ path, filename, label = 'Export CSV' }: { path: string; filename: string; label?: string }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  return (
    <button
      className="btn btn-outline btn-sm"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await download(path, filename);
        } catch (e) {
          toast(e instanceof Error ? e.message : 'Export failed', 'error');
        } finally {
          setBusy(false);
        }
      }}
    >
      <Download className="h-4 w-4" aria-hidden /> {label}
    </button>
  );
}

export function QueryError({ error, retry }: { error: unknown; retry?: () => void }) {
  return <ErrorState message={error instanceof Error ? error.message : undefined} onRetry={retry} />;
}

/** Key/value grid for detail screens. */
export function DetailList({ items }: { items: [ReactNode, ReactNode][] }) {
  return (
    <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
      {items.map(([k, v], i) => (
        <div key={i}>
          <dt className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{k}</dt>
          <dd className="mt-0.5 break-words text-sm">{v || <span className="text-ink-muted">—</span>}</dd>
        </div>
      ))}
    </dl>
  );
}

export function AdminSelect({ value, onChange, options, label }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; label: string }) {
  return (
    <label className="block w-full sm:w-auto">
      <span className="sr-only">{label}</span>
      <select className="admin-input sm:w-auto" value={value} onChange={(e) => onChange(e.target.value)} aria-label={label}>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}
