import { useMemo, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { BarChart3, Printer } from 'lucide-react';
import type { Permission } from '@ngo/shared';
import { api, qs } from '@/lib/api';
import { date } from '@/lib/format';
import { useAuth } from '@/app/AuthProvider';
import { Button, EmptyState } from '@/components/ui';
import { AdminPage, ExportButton, QueryError } from '../ui';
import { LoadingBlock, daysAgo, isoDay } from './_common';

type ReportType = 'donations-monthly' | 'campaigns' | 'volunteers' | 'events' | 'projects' | 'assistance';
type Row = Record<string, string | number | boolean | null>;

const REPORTS: { type: ReportType; label: string; description: string; needs: Permission[]; ranged: boolean }[] = [
  { type: 'donations-monthly', label: 'Donations by month', description: 'Gift counts and amounts per month and status. Refunds shown separately.', needs: ['donations.view'], ranged: true },
  { type: 'campaigns', label: 'Campaign performance', description: 'Net raised (successful payments only) versus goal for every campaign.', needs: ['donations.view', 'campaigns.manage'], ranged: true },
  { type: 'volunteers', label: 'Volunteer hours', description: 'Hours logged and assignments per active or past volunteer.', needs: ['volunteers.view', 'volunteers.manage'], ranged: true },
  { type: 'events', label: 'Events & attendance', description: 'Registrations, attendance and volunteers for events in the period.', needs: [], ranged: true },
  { type: 'projects', label: 'Projects', description: 'Phase, reach and activity for every project (not date-filtered).', needs: [], ranged: false },
  { type: 'assistance', label: 'Assistance distributed', description: 'Aggregated assistance by month and type. No personal data.', needs: ['beneficiaries.view', 'beneficiaries.manage'], ranged: true },
];

const MONEY_COLUMNS = new Set(['amount', 'refunded', 'goal', 'raised']);
const LABELS: Record<string, string> = { beneficiariesReached: 'Reached', beneficiaryRecords: 'Beneficiary records', volunteerAssignments: 'Volunteer assignments', percent: '% of goal' };
const label = (c: string) => LABELS[c] ?? c.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase());
const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 });
const fmt = (c: string, v: Row[string]) => {
  if (v === null || v === '') return '—';
  if (MONEY_COLUMNS.has(c) && typeof v === 'number') return inr.format(v);
  if (c === 'percent' && typeof v === 'number') return `${v}%`;
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (typeof v === 'number') return v.toLocaleString('en-IN');
  return v;
};

const PRESETS = [
  { label: 'Last 30 days', days: 30 },
  { label: 'Last 90 days', days: 90 },
  { label: 'Last 12 months', days: 365 },
];

export default function ReportsPage() {
  const { can } = useAuth();
  const available = REPORTS.filter((r) => can('reports.view') && (r.needs.length === 0 || can(...r.needs)));
  const [type, setType] = useState<ReportType | undefined>(available[0]?.type);
  const [range, setRange] = useState({ from: daysAgo(365), to: isoDay() });
  const report = available.find((r) => r.type === type) ?? available[0];
  const params = report?.ranged ? range : {};

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ['admin', 'report', report?.type, params],
    queryFn: () => api<{ data: Row[]; meta: { columns: string[]; from: string; to: string } }>(`/admin/reports/${report!.type}${qs(params)}`),
    enabled: Boolean(report),
    placeholderData: keepPreviousData,
  });

  if (!report)
    return (
      <AdminPage title="Reports">
        <EmptyState icon={BarChart3} title="No reports available">Your role does not include access to any reports.</EmptyState>
      </AdminPage>
    );

  const columns = data?.meta.columns ?? [];
  const rows = data?.data ?? [];

  return (
    <AdminPage
      title="Reports"
      description="Operational and financial reports. Financial figures include only verified successful payments unless the status column says otherwise."
      actions={
        <div className="flex flex-wrap gap-2 print:hidden">
          <ExportButton path={`/admin/reports/${report.type}${qs({ ...params, format: 'csv' })}`} filename={`${report.type}-${isoDay()}.csv`} />
          <Button size="sm" variant="outline" icon={Printer} onClick={() => window.print()}>Print</Button>
        </div>
      }
    >
      <div className="mb-6 space-y-4 print:hidden">
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Report">
          {available.map((r) => (
            <button key={r.type} role="tab" aria-selected={r.type === report.type} onClick={() => setType(r.type)} className={`rounded-full border px-3 py-1.5 text-sm transition ${r.type === report.type ? 'border-primary bg-primary text-primary-contrast' : 'border-line bg-surface hover:border-primary'}`}>
              {r.label}
            </button>
          ))}
        </div>
        {report.ranged && (
          <div className="flex flex-wrap items-center gap-2">
            <input type="date" aria-label="From" className="admin-input w-auto" value={range.from} max={range.to} onChange={(e) => setRange({ ...range, from: e.target.value })} />
            <span className="text-ink-muted">–</span>
            <input type="date" aria-label="To" className="admin-input w-auto" value={range.to} min={range.from} onChange={(e) => setRange({ ...range, to: e.target.value })} />
            {PRESETS.map((p) => (
              <Button key={p.days} size="sm" variant="ghost" onClick={() => setRange({ from: daysAgo(p.days), to: isoDay() })}>{p.label}</Button>
            ))}
          </div>
        )}
      </div>

      <div className="admin-card print:border-0 print:p-0">
        <div className="mb-4">
          <h2 className="font-heading text-xl">{report.label}</h2>
          <p className="text-sm text-ink-muted">{report.description}</p>
          {report.ranged && <p className="mt-1 text-xs text-ink-muted">Period: {date(range.from)} – {date(range.to)} · generated {new Date().toLocaleString('en-IN')}</p>}
        </div>
        {error ? (
          <QueryError error={error} retry={refetch} />
        ) : isLoading ? (
          <LoadingBlock />
        ) : rows.length === 0 ? (
          <EmptyState icon={BarChart3} title="No data for this period">Try a wider date range.</EmptyState>
        ) : (
          <div className={isFetching ? 'opacity-60 transition' : 'transition'}>
            <ReportChart type={report.type} rows={rows} />
            <div className="-mx-5 overflow-x-auto print:mx-0 print:overflow-visible">
              <table className="table-base">
                <thead>
                  <tr>{columns.map((c) => <th key={c} className={typeof rows[0]?.[c] === 'number' ? 'text-right' : undefined}>{label(c)}</th>)}</tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i}>
                      {columns.map((c) => (
                        <td key={c} className={typeof r[c] === 'number' ? 'whitespace-nowrap text-right tabular-nums' : undefined}>{fmt(c, r[c])}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs text-ink-muted">{rows.length} rows</p>
          </div>
        )}
      </div>
    </AdminPage>
  );
}

function ReportChart({ type, rows }: { type: ReportType; rows: Row[] }) {
  const chart = useMemo(() => {
    const n = (v: Row[string]) => (typeof v === 'number' ? v : Number(v) || 0);
    switch (type) {
      case 'donations-monthly': {
        const m = new Map<string, { name: string; net: number }>();
        rows.filter((r) => r.status === 'SUCCESS' || r.status === 'PARTIALLY_REFUNDED').forEach((r) => {
          const k = String(r.month);
          const cur = m.get(k) ?? { name: k, net: 0 };
          cur.net += n(r.amount) - n(r.refunded);
          m.set(k, cur);
        });
        return { data: [...m.values()], bars: [{ key: 'net', name: 'Net raised (successful)', money: true }], layout: 'horizontal' as const };
      }
      case 'campaigns':
        return { data: rows.slice(0, 8).map((r) => ({ name: String(r.campaign).slice(0, 24), raised: n(r.raised), goal: n(r.goal) })), bars: [{ key: 'goal', name: 'Goal', money: true, muted: true }, { key: 'raised', name: 'Raised', money: true }], layout: 'vertical' as const };
      case 'volunteers':
        return { data: rows.filter((r) => n(r.hours) > 0).slice(0, 10).map((r) => ({ name: String(r.volunteer), hours: n(r.hours) })), bars: [{ key: 'hours', name: 'Hours' }], layout: 'vertical' as const };
      case 'events':
        return { data: rows.slice(0, 10).reverse().map((r) => ({ name: String(r.event).slice(0, 20), registered: n(r.registered), attended: n(r.attended) })), bars: [{ key: 'registered', name: 'Registered', muted: true }, { key: 'attended', name: 'Attended' }], layout: 'horizontal' as const };
      case 'assistance': {
        const m = new Map<string, { name: string; records: number }>();
        rows.forEach((r) => {
          const k = String(r.month);
          const cur = m.get(k) ?? { name: k, records: 0 };
          cur.records += n(r.records);
          m.set(k, cur);
        });
        return { data: [...m.values()], bars: [{ key: 'records', name: 'Assistance records' }], layout: 'horizontal' as const };
      }
      default:
        return null;
    }
  }, [type, rows]);
  if (!chart || chart.data.length === 0) return null;
  const moneyTick = (v: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', notation: 'compact', maximumFractionDigits: 1 }).format(v);
  const isMoney = chart.bars.some((b) => 'money' in b && b.money);
  const vertical = chart.layout === 'vertical';
  return (
    <div className="mb-6 break-inside-avoid" style={{ height: vertical ? Math.max(200, chart.data.length * 36) : 260 }} role="img" aria-label={`Chart of ${type} report`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chart.data} layout={chart.layout} margin={{ left: 8, right: 16, top: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--c-border))" vertical={!vertical ? false : true} horizontal={vertical ? false : true} />
          {vertical ? (
            <>
              <XAxis type="number" fontSize={11} stroke="rgb(var(--c-muted))" tickFormatter={isMoney ? moneyTick : undefined} />
              <YAxis type="category" dataKey="name" width={130} fontSize={11} stroke="rgb(var(--c-muted))" />
            </>
          ) : (
            <>
              <XAxis dataKey="name" fontSize={11} stroke="rgb(var(--c-muted))" />
              <YAxis fontSize={11} width={64} stroke="rgb(var(--c-muted))" tickFormatter={isMoney ? moneyTick : undefined} allowDecimals={false} />
            </>
          )}
          <Tooltip formatter={(v: number) => (isMoney ? inr.format(v) : v.toLocaleString('en-IN'))} contentStyle={{ borderRadius: 12, fontSize: 12 }} />
          {chart.bars.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
          {chart.bars.map((b) => (
            <Bar key={b.key} dataKey={b.key} name={b.name} fill={'muted' in b && b.muted ? 'rgb(var(--c-border))' : 'rgb(var(--c-primary))'} radius={vertical ? [0, 4, 4, 0] : [4, 4, 0, 0]} isAnimationActive={false} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
