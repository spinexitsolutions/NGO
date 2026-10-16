/** Helpers shared by the admin operations screens (donations, volunteers, beneficiaries, system). */
import { useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { MessageSquare } from 'lucide-react';
import { ApiError, get, send } from '@/lib/api';
import { dateTime } from '@/lib/format';
import { cn } from '@/lib/cn';
import { Button, useToast } from '@/components/ui';

export interface InternalNote {
  id: string;
  body: string;
  createdAt: string;
  author: { name: string } | null;
}

export interface OptionRow {
  id: string;
  label: string;
  status?: string;
}

export const errorMessage = (e: unknown, fallback = 'Something went wrong') => (e instanceof Error && e.message ? e.message : fallback);
export const fieldErrorsOf = (e: unknown): Record<string, string> => (e instanceof ApiError ? e.fieldErrors : {});

/** YYYY-MM-DD in local time. */
export function isoDay(d: Date = new Date()) {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
export const daysAgo = (n: number) => isoDay(new Date(Date.now() - n * 86_400_000));

/**
 * Mutation with toast feedback and cache invalidation.
 * Field errors from the API are handed to `onFieldErrors` so forms can show them inline.
 */
export function useApiMutation<V, R>(
  fn: (vars: V) => Promise<R>,
  opts: { success?: string | ((r: R, v: V) => string); invalidate?: QueryKey[]; onSuccess?: (r: R, v: V) => void; onFieldErrors?: (errors: Record<string, string>) => void } = {},
) {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: fn,
    onSuccess: async (r, v) => {
      opts.onFieldErrors?.({});
      await Promise.all((opts.invalidate ?? []).map((queryKey) => qc.invalidateQueries({ queryKey })));
      if (opts.success) toast(typeof opts.success === 'function' ? opts.success(r, v) : opts.success);
      opts.onSuccess?.(r, v);
    },
    onError: (e) => {
      opts.onFieldErrors?.(fieldErrorsOf(e));
      toast(errorMessage(e), 'error');
    },
  });
}

/** id/label list for relation pickers (`/admin/collections/:key/options`). */
export function useOptions(collection: string, enabled = true) {
  return useQuery({
    queryKey: ['admin', 'options', collection],
    queryFn: () => get<OptionRow[]>(`/admin/collections/${collection}/options`),
    staleTime: 5 * 60_000,
    enabled,
  });
}

/** Labelled admin form control. */
export function AdminField({ label, error, help, required, className, children }: { label: ReactNode; error?: string; help?: ReactNode; required?: boolean; className?: string; children: ReactNode }) {
  return (
    <label className={cn('block', className)}>
      <span className="admin-label">
        {label}
        {required && <span className="ml-0.5 text-red-700" aria-hidden>*</span>}
      </span>
      {children}
      {help && !error && <span className="mt-1 block text-xs text-ink-muted">{help}</span>}
      {error && <span className="mt-1 block text-xs font-medium text-red-700" role="alert">{error}</span>}
    </label>
  );
}

/** Titled admin card. */
export function Section({ title, actions, children, className }: { title: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn('admin-card', className)}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-heading text-lg">{title}</h2>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
      {children}
    </section>
  );
}

export function SampleBadge() {
  return <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber-900">Sample data</span>;
}

/** Internal notes list + composer (POST /admin/notes). */
export function NotesPanel({ entityType, entityId, notes, invalidate, canAdd = true }: { entityType: 'Donation' | 'Donor' | 'VolunteerApplication' | 'ContactInquiry'; entityId: string; notes: InternalNote[]; invalidate: QueryKey; canAdd?: boolean }) {
  const [body, setBody] = useState('');
  const add = useApiMutation((text: string) => send<InternalNote>('/admin/notes', { entityType, entityId, body: text }), {
    success: 'Note added',
    invalidate: [invalidate],
    onSuccess: () => setBody(''),
  });
  return (
    <Section title="Internal notes">
      {canAdd && (
        <form
          className="mb-4 space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (body.trim()) add.mutate(body.trim());
          }}
        >
          <label className="sr-only" htmlFor={`note-${entityId}`}>Add a note</label>
          <textarea id={`note-${entityId}`} className="admin-input min-h-[80px]" placeholder="Add a note for the team (not visible to the public)…" value={body} maxLength={2000} onChange={(e) => setBody(e.target.value)} />
          <div className="flex justify-end">
            <Button size="sm" type="submit" loading={add.isPending} disabled={!body.trim()}>Add note</Button>
          </div>
        </form>
      )}
      {notes.length === 0 ? (
        <p className="flex items-center gap-2 text-sm text-ink-muted"><MessageSquare className="h-4 w-4" aria-hidden /> No notes yet.</p>
      ) : (
        <ul className="space-y-3">
          {notes.map((n) => (
            <li key={n.id} className="rounded-xl bg-surface-alt/60 p-3">
              <p className="whitespace-pre-wrap text-sm">{n.body}</p>
              <p className="mt-1 text-xs text-ink-muted">{n.author?.name ?? 'Former staff'} · {dateTime(n.createdAt)}</p>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

/** Small pill-style chip used for tags (interests, skills, programmes). */
export function Chips({ items }: { items: string[] }) {
  if (!items.length) return <span className="text-ink-muted">—</span>;
  return (
    <span className="flex flex-wrap gap-1">
      {items.map((t) => <span key={t} className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">{t}</span>)}
    </span>
  );
}

export function LoadingBlock() {
  return (
    <div className="grid min-h-[30vh] place-items-center" aria-busy="true">
      <span className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" aria-label="Loading" />
    </div>
  );
}

export const PASSWORD_HINT = 'At least 10 characters, with letters and numbers.';
