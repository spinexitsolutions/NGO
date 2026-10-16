import { Fragment, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, ChevronRight, ScrollText } from 'lucide-react';
import { get } from '@/lib/api';
import { dateTime } from '@/lib/format';
import { useAuth } from '@/app/AuthProvider';
import { Button, EmptyState } from '@/components/ui';
import { AdminPage, AdminSelect, FilterBar, ListFooter, QueryError, SearchInput, useAdminList } from '../ui';
import { LoadingBlock } from './_common';

interface AuditRow {
  id: string;
  actorId: string | null;
  actor: { name: string; email: string } | null;
  action: string;
  entityType: string;
  entityId: string;
  summary: string;
  before: unknown;
  after: unknown;
  ip: string;
  userAgent: string;
  createdAt: string;
}

const ENTITY_TYPES = [
  'AssistanceRecord', 'Beneficiary', 'CampaignUpdate', 'ConfigDocument', 'ContactInquiry', 'Donation', 'Donor', 'EmailTemplate', 'Event', 'EventRegistration', 'MediaAsset',
  'NewsletterSubscriber', 'Page', 'Receipt', 'RecurringDonation', 'Report', 'Role', 'SectionTemplate', 'Session', 'User', 'VolunteerApplication', 'VolunteerAssignment', 'VolunteerHours', 'VolunteerProfile',
  // Content collections are logged under their collection key.
  'causes', 'campaigns', 'campaignUpdates', 'projects', 'projectReports', 'events', 'stories', 'posts', 'team', 'partners', 'opportunities', 'jobs', 'documents', 'galleryAlbums', 'faqs', 'testimonials', 'impactStats', 'categories',
];

function useDebounced<T>(value: T, ms = 350) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export default function AuditPage() {
  const { can } = useAuth();
  const [entityType, setEntityType] = useState('');
  const [actionInput, setActionInput] = useState('');
  const action = useDebounced(actionInput.trim());
  const [actorId, setActorId] = useState('');
  const [entityId, setEntityId] = useState('');
  const [open, setOpen] = useState<Set<string>>(new Set());
  const { rows, meta, isLoading, error, refetch, setPage } = useAdminList<AuditRow>('/admin/audit', { entityType, action: action || undefined, actorId, entityId: entityId.trim() || undefined }, 'audit');
  const staff = useQuery({ queryKey: ['admin', 'users'], queryFn: () => get<{ id: string; name: string }[]>('/admin/users'), enabled: can('users.manage') });

  const [seenActors, setSeenActors] = useState<Map<string, string>>(new Map());
  useEffect(() => {
    if (!rows?.length) return;
    setSeenActors((prev) => {
      const next = new Map(prev);
      rows.forEach((r) => r.actorId && r.actor && next.set(r.actorId, r.actor.name));
      return next.size === prev.size ? prev : next;
    });
  }, [rows]);
  const actorOptions = useMemo(() => {
    const list = staff.data ? staff.data.map((u) => ({ value: u.id, label: u.name })) : [...seenActors.entries()].map(([value, label]) => ({ value, label }));
    return [{ value: '', label: 'All actors' }, ...list.sort((a, b) => a.label.localeCompare(b.label))];
  }, [staff.data, seenActors]);

  const toggle = (id: string) =>
    setOpen((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const reset = () => {
    setEntityType('');
    setActionInput('');
    setActorId('');
    setEntityId('');
    setPage(1);
  };
  const filtered = Boolean(entityType || actionInput || actorId || entityId);

  return (
    <AdminPage title="Audit log" description="A tamper-evident record of sensitive actions: who did what, when and from where. Entries cannot be edited.">
      <FilterBar>
        <SearchInput value={actionInput} onChange={(v) => { setActionInput(v); setPage(1); }} placeholder="Action contains… e.g. refund" />
        <AdminSelect label="Entity type" value={entityType} onChange={(v) => { setEntityType(v); setPage(1); }} options={[{ value: '', label: 'All entity types' }, ...ENTITY_TYPES.map((t) => ({ value: t, label: t }))]} />
        <AdminSelect label="Actor" value={actorId} onChange={(v) => { setActorId(v); setPage(1); }} options={actorOptions} />
        <label className="block w-full sm:w-auto">
          <span className="sr-only">Entity ID</span>
          <input className="admin-input font-mono sm:w-48" placeholder="Entity ID" value={entityId} onChange={(e) => { setEntityId(e.target.value); setPage(1); }} />
        </label>
        {filtered && <Button size="sm" variant="ghost" onClick={reset}>Clear filters</Button>}
      </FilterBar>
      {error ? (
        <QueryError error={error} retry={refetch} />
      ) : isLoading ? (
        <LoadingBlock />
      ) : !rows?.length ? (
        <EmptyState icon={ScrollText} title="No audit entries match" />
      ) : (
        <>
          <div className="admin-card overflow-x-auto p-0">
            <table className="table-base">
              <thead>
                <tr><th className="w-8"><span className="sr-only">Expand</span></th><th>When</th><th>Actor</th><th>Action</th><th>Entity</th><th>Summary</th></tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const hasDiff = r.before != null || r.after != null;
                  const isOpen = open.has(r.id);
                  return (
                    <Fragment key={r.id}>
                      <tr className="cursor-pointer" onClick={() => toggle(r.id)}>
                        <td>
                          <button className="rounded p-1 hover:bg-surface-alt" aria-expanded={isOpen} aria-label={isOpen ? 'Collapse details' : 'Expand details'} onClick={(e) => { e.stopPropagation(); toggle(r.id); }}>
                            {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          </button>
                        </td>
                        <td className="whitespace-nowrap text-xs">{dateTime(r.createdAt)}</td>
                        <td className="whitespace-nowrap">{r.actor?.name ?? <span className="text-ink-muted">System</span>}</td>
                        <td><code className="whitespace-nowrap text-xs">{r.action}</code></td>
                        <td className="whitespace-nowrap text-xs">{r.entityType}{r.entityId && <span className="block font-mono text-[11px] text-ink-muted">{r.entityId}</span>}</td>
                        <td className="min-w-[12rem] text-sm">{r.summary || (hasDiff ? <span className="text-ink-muted">Changes recorded</span> : <span className="text-ink-muted">—</span>)}</td>
                      </tr>
                      {isOpen && (
                        <tr className="bg-surface-alt/40 hover:bg-surface-alt/40">
                          <td />
                          <td colSpan={5}>
                            <div className="space-y-3 py-1">
                              <p className="text-xs text-ink-muted">
                                {r.actor?.email && <>Actor email: {r.actor.email} · </>}IP: {r.ip || '—'}{r.userAgent && <> · <span className="break-all">{r.userAgent}</span></>}
                              </p>
                              {r.entityId && (
                                <Button size="sm" variant="ghost" onClick={() => { setEntityType(r.entityType); setEntityId(r.entityId); setPage(1); }}>Show all entries for this {r.entityType}</Button>
                              )}
                              {hasDiff ? (
                                <div className="grid gap-3 lg:grid-cols-2">
                                  <JsonBlock title="Before" value={r.before} />
                                  <JsonBlock title="After" value={r.after} />
                                </div>
                              ) : (
                                <p className="text-xs text-ink-muted">No before/after snapshot for this action.</p>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
          <ListFooter meta={meta} setPage={setPage} />
        </>
      )}
    </AdminPage>
  );
}

function JsonBlock({ title, value }: { title: string; value: unknown }) {
  return (
    <div className="min-w-0">
      <p className="admin-label">{title}</p>
      <pre className="max-h-80 overflow-auto rounded-lg border border-line bg-surface p-3 text-[11px] leading-relaxed">{value == null ? '—' : JSON.stringify(value, null, 2)}</pre>
    </div>
  );
}
