import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Baby, Plus, UsersRound } from 'lucide-react';
import { get, qs, send } from '@/lib/api';
import { date, money, titleCase } from '@/lib/format';
import { useAuth } from '@/app/AuthProvider';
import { Badge, Button, EmptyState, Modal, StatusBadge, Tabs } from '@/components/ui';
import { AdminPage, AdminSelect, DataTable, ExportButton, FilterBar, ListFooter, QueryError, SearchInput, StatCard, useAdminList, type Column } from '../ui';
import { Chips, LoadingBlock, Section, isoDay, useApiMutation, useOptions } from './_common';
import { BeneficiaryForm, PrivacyNotice, blankBeneficiary, beneficiaryPayload, type BeneficiaryFormValue } from './_beneficiary';

interface BeneficiaryRow {
  id: string;
  code: string;
  fullName: string;
  gender: string;
  isMinor: boolean;
  village: string;
  district: string;
  status: string;
  programs: string[];
  project: { title: string } | null;
  createdAt: string;
}
interface Summary {
  byType: { type: string; unit: string; _sum: { quantity: number | null; valueAmount: number | null }; _count: number }[];
  byDistrict: { district: string; _count: number }[];
  byStatus: { status: string; _count: number }[];
  uniqueBeneficiariesServed: number;
}

export default function BeneficiariesPage() {
  const { can } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<'records' | 'summary'>('records');
  const [q, setQ] = useState('');
  const [projectId, setProjectId] = useState('');
  const [status, setStatus] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const projects = useOptions('projects');
  const filters = { q: q.trim() || undefined, projectId, status };
  const { rows, meta, isLoading, error, refetch, setPage } = useAdminList<BeneficiaryRow>('/admin/beneficiaries', filters, 'beneficiaries');
  const manage = can('beneficiaries.manage');

  const columns: Column<BeneficiaryRow>[] = [
    { key: 'code', header: 'Code', render: (b) => <span className="font-mono text-xs">{b.code}</span> },
    { key: 'name', header: 'Name', render: (b) => <span className="flex items-center gap-2 whitespace-nowrap">{b.fullName}{b.isMinor && <Badge tone="amber"><Baby className="h-3 w-3" aria-hidden />Minor</Badge>}</span> },
    { key: 'gender', header: 'Gender', render: (b) => (b.gender ? titleCase(b.gender) : <span className="text-ink-muted">—</span>) },
    { key: 'place', header: 'Village / district', render: (b) => [b.village, b.district].filter(Boolean).join(', ') || <span className="text-ink-muted">—</span> },
    { key: 'project', header: 'Project', render: (b) => b.project?.title ?? <span className="text-ink-muted">—</span> },
    { key: 'programs', header: 'Programmes', render: (b) => <div className="min-w-[8rem]"><Chips items={b.programs} /></div> },
    { key: 'status', header: 'Status', render: (b) => <StatusBadge status={b.status} /> },
    { key: 'added', header: 'Added', render: (b) => <span className="whitespace-nowrap">{date(b.createdAt)}</span> },
  ];

  return (
    <AdminPage
      title="Beneficiaries"
      description="People supported by our programmes, and the assistance they have received."
      actions={
        <>
          {manage && <ExportButton path={`/admin/beneficiaries${qs({ ...filters, format: 'csv' })}`} filename={`beneficiaries-${isoDay()}.csv`} label="Export CSV (no contact details)" />}
          {manage && <Button size="sm" icon={Plus} onClick={() => setCreateOpen(true)}>Add beneficiary</Button>}
        </>
      }
    >
      <PrivacyNotice />
      <Tabs className="mb-4" value={tab} onChange={setTab} tabs={[{ value: 'records', label: 'Records' }, { value: 'summary', label: 'Summary (aggregated)' }]} />
      {tab === 'records' ? (
        <>
          <FilterBar>
            <SearchInput value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Code, name or village…" />
            <AdminSelect label="Project" value={projectId} onChange={(v) => { setProjectId(v); setPage(1); }} options={[{ value: '', label: 'All projects' }, ...(projects.data ?? []).map((p) => ({ value: p.id, label: p.label }))]} />
            <AdminSelect label="Status" value={status} onChange={(v) => { setStatus(v); setPage(1); }} options={[{ value: '', label: 'All statuses' }, { value: 'ACTIVE', label: 'Active' }, { value: 'FOLLOW_UP', label: 'Follow-up' }, { value: 'EXITED', label: 'Exited' }]} />
          </FilterBar>
          {error ? (
            <QueryError error={error} retry={refetch} />
          ) : (
            <>
              <DataTable rows={rows} columns={columns} loading={isLoading} rowHref={(b) => `/admin/beneficiaries/${b.id}`} empty={<EmptyState icon={UsersRound} title="No beneficiary records found" />} />
              <ListFooter meta={meta} setPage={setPage} />
            </>
          )}
        </>
      ) : (
        <SummaryTab />
      )}
      <CreateModal open={createOpen} onClose={() => setCreateOpen(false)} onCreated={(id) => navigate(`/admin/beneficiaries/${id}`)} />
    </AdminPage>
  );
}

function SummaryTab() {
  const [range, setRange] = useState({ from: '', to: '' });
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['admin', 'beneficiaries-summary', range], queryFn: () => get<Summary>(`/admin/beneficiaries/summary${qs(range)}`) });
  if (error) return <QueryError error={error} retry={refetch} />;
  if (isLoading || !data) return <LoadingBlock />;
  const total = data.byStatus.reduce((n, s) => n + s._count, 0);
  const districts = [...data.byDistrict].sort((a, b) => b._count - a._count);
  return (
    <div className="space-y-6">
      <FilterBar>
        <span className="text-sm text-ink-muted">Assistance distributed between</span>
        <input type="date" aria-label="From" className="admin-input w-auto" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} />
        <span className="text-ink-muted">and</span>
        <input type="date" aria-label="To" className="admin-input w-auto" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} />
        {(range.from || range.to) && <Button size="sm" variant="ghost" onClick={() => setRange({ from: '', to: '' })}>All time</Button>}
      </FilterBar>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Unique people served" value={data.uniqueBeneficiariesServed.toLocaleString('en-IN')} hint="With at least one assistance record in range" tone="green" />
        <StatCard label="Registered beneficiaries" value={total.toLocaleString('en-IN')} />
        {data.byStatus.map((s) => <StatCard key={s.status} label={titleCase(s.status)} value={s._count.toLocaleString('en-IN')} />)}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Assistance by type">
          {data.byType.length === 0 ? (
            <EmptyState title="No assistance recorded in this period" />
          ) : (
            <div className="-mx-5 overflow-x-auto">
              <table className="table-base">
                <thead><tr><th>Type</th><th className="text-right">Records</th><th className="text-right">Quantity</th><th className="text-right">Value</th></tr></thead>
                <tbody>
                  {data.byType.map((t) => (
                    <tr key={`${t.type}-${t.unit}`}>
                      <td>{t.type}</td>
                      <td className="text-right">{t._count}</td>
                      <td className="whitespace-nowrap text-right">{(t._sum.quantity ?? 0).toLocaleString('en-IN')} {t.unit}</td>
                      <td className="whitespace-nowrap text-right">{t._sum.valueAmount ? money(t._sum.valueAmount) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>
        <Section title="Beneficiaries by district">
          {districts.length === 0 ? (
            <EmptyState title="No records yet" />
          ) : (
            <div style={{ height: Math.max(180, districts.length * 32) }} role="img" aria-label="Bar chart of beneficiaries per district">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart layout="vertical" data={districts.map((d) => ({ name: d.district || 'Not recorded', count: d._count }))} margin={{ left: 8, right: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--c-border))" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} fontSize={11} stroke="rgb(var(--c-muted))" />
                  <YAxis type="category" dataKey="name" width={110} fontSize={11} stroke="rgb(var(--c-muted))" />
                  <Tooltip formatter={(v: number) => [v, 'Beneficiaries']} contentStyle={{ borderRadius: 12, fontSize: 12 }} />
                  <Bar dataKey="count" fill="rgb(var(--c-primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Section>
      </div>
    </div>
  );
}

function CreateModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (id: string) => void }) {
  const [f, setF] = useState<BeneficiaryFormValue>(blankBeneficiary);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const create = useApiMutation(() => send<{ id: string; code: string }>('/admin/beneficiaries', beneficiaryPayload(f)), {
    success: (r) => `Beneficiary ${r.code} created`,
    invalidate: [['admin', 'beneficiaries'], ['admin', 'beneficiaries-summary']],
    onFieldErrors: setErrors,
    onSuccess: (r) => {
      setF(blankBeneficiary);
      onClose();
      onCreated(r.id);
    },
  });
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add beneficiary"
      size="lg"
      footer={
        <>
          <Button size="sm" variant="outline" onClick={onClose}>Cancel</Button>
          <Button size="sm" type="submit" form="beneficiary-create" loading={create.isPending}>Create record</Button>
        </>
      }
    >
      <form id="beneficiary-create" onSubmit={(e) => { e.preventDefault(); create.mutate(undefined); }}>
        <BeneficiaryForm value={f} onChange={setF} errors={errors} />
      </form>
    </Modal>
  );
}
