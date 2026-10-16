import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Activity, AlertTriangle, CalendarDays, CheckCircle2, Clock, FileText, FolderKanban, HandCoins, HandHeart, Inbox, IndianRupee, Megaphone, PenSquare, Plus, RotateCcw, UserCheck, Users, XCircle } from 'lucide-react';
import { get, qs } from '@/lib/api';
import { date, money, relative } from '@/lib/format';
import { useAuth } from '@/app/AuthProvider';
import { EmptyState, Skeleton } from '@/components/ui';
import { AdminPage, QueryError, StatCard } from '../ui';
import { Section, daysAgo, isoDay } from './_common';

interface StatusAgg { count: number; amount: number; refunded: number }
interface Overview {
  range: { from: string; to: string };
  finance: null | {
    netRaised: number;
    successfulCount: number;
    byStatus: Record<string, StatusAgg>;
    trend: { day: string; amount: number; count: number }[];
    campaigns: { id: string; title: string; goal: number; raised: number }[];
  };
  counts: { activeCampaigns: number; volunteers: number; pendingApplications: number; activeProjects: number; upcomingEvents: number; newInquiries: number };
  recentActivity: { id: string; action: string; summary: string; entityType: string; actor: string; at: string }[];
}

type Preset = '30d' | '90d' | '12m' | 'custom';
const PRESETS: { value: Preset; label: string }[] = [
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
  { value: '12m', label: 'Last 12 months' },
  { value: 'custom', label: 'Custom' },
];

const EMPTY: StatusAgg = { count: 0, amount: 0, refunded: 0 };

export default function DashboardPage() {
  const { can } = useAuth();
  const [preset, setPreset] = useState<Preset>('30d');
  const [custom, setCustom] = useState({ from: daysAgo(30), to: isoDay() });
  const range = useMemo(() => {
    if (preset === 'custom') return custom;
    const days = preset === '30d' ? 30 : preset === '90d' ? 90 : 365;
    return { from: daysAgo(days), to: isoDay() };
  }, [preset, custom]);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['admin', 'dashboard', range],
    queryFn: () => get<Overview>(`/admin/dashboard/overview${qs(range)}`),
  });

  const fin = data?.finance;
  const s = (k: string) => fin?.byStatus[k] ?? EMPTY;
  const pending = s('PENDING');
  const failed = s('FAILED');
  const refunded = { count: s('REFUNDED').count + s('PARTIALLY_REFUNDED').count, amount: s('REFUNDED').refunded + s('PARTIALLY_REFUNDED').refunded };

  const quickActions = [
    can('donations.manage') && { href: '/admin/donations?record=1', label: 'Record offline donation', icon: HandCoins },
    can('campaigns.manage') && { href: '/admin/content/campaigns/new', label: 'New campaign', icon: Megaphone },
    can('events.manage') && { href: '/admin/content/events/new', label: 'New event', icon: CalendarDays },
    can('blog.manage') && { href: '/admin/content/posts/new', label: 'Write post', icon: PenSquare },
    can('volunteers.view', 'volunteers.manage') && { href: '/admin/volunteers/applications?status=SUBMITTED', label: 'Review volunteers', icon: UserCheck },
  ].filter(Boolean) as { href: string; label: string; icon: typeof Plus }[];

  return (
    <AdminPage
      title="Dashboard"
      description="An overview of fundraising, volunteering and programme activity."
      actions={
        <div className="flex flex-wrap items-end gap-2">
          <div role="group" aria-label="Date range" className="inline-flex overflow-hidden rounded-lg border border-line">
            {PRESETS.map((p) => (
              <button key={p.value} onClick={() => setPreset(p.value)} className={`px-3 py-2 text-xs font-medium transition ${preset === p.value ? 'bg-primary text-primary-contrast' : 'bg-surface hover:bg-surface-alt'}`} aria-pressed={preset === p.value}>
                {p.label}
              </button>
            ))}
          </div>
          {preset === 'custom' && (
            <div className="flex items-center gap-2">
              <input type="date" aria-label="From" className="admin-input w-auto" value={custom.from} max={custom.to} onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))} />
              <span className="text-ink-muted">–</span>
              <input type="date" aria-label="To" className="admin-input w-auto" value={custom.to} min={custom.from} max={isoDay()} onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))} />
            </div>
          )}
        </div>
      }
    >
      {error ? (
        <QueryError error={error} retry={refetch} />
      ) : isLoading || !data ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-24" />)}</div>
      ) : (
        <div className="space-y-6">
          {quickActions.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {quickActions.map((a) => (
                <Link key={a.href} to={a.href} className="btn btn-outline btn-sm">
                  <a.icon className="h-4 w-4" aria-hidden /> {a.label}
                </Link>
              ))}
            </div>
          )}

          {fin && (
            <section aria-labelledby="fin-h">
              <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                <h2 id="fin-h" className="font-heading text-xl">Fundraising</h2>
                <p className="text-xs text-ink-muted">
                  {date(range.from)} – {date(range.to)} · Totals include only <strong>verified successful payments</strong>, net of refunds.
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                <StatCard label="Net raised" value={money(fin.netRaised)} icon={IndianRupee} tone="green" hint="Verified successful only" href={can('donations.view') ? '/admin/donations?status=SUCCESS' : undefined} />
                <StatCard label="Successful gifts" value={fin.successfulCount.toLocaleString('en-IN')} icon={CheckCircle2} tone="green" />
                <StatCard label="Pending" value={pending.count.toLocaleString('en-IN')} hint={`${money(pending.amount)} awaiting confirmation`} icon={Clock} tone="amber" href="/admin/donations?status=PENDING" />
                <StatCard label="Failed" value={failed.count.toLocaleString('en-IN')} hint={money(failed.amount)} icon={XCircle} tone="red" href="/admin/donations?status=FAILED" />
                <StatCard label="Refunded" value={refunded.count.toLocaleString('en-IN')} hint={money(refunded.amount)} icon={RotateCcw} tone="red" />
              </div>
            </section>
          )}

          <section aria-labelledby="ops-h">
            <h2 id="ops-h" className="mb-3 font-heading text-xl">Operations</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              <StatCard label="Active campaigns" value={data.counts.activeCampaigns} icon={Megaphone} href="/admin/content/campaigns" />
              <StatCard label="Active volunteers" value={data.counts.volunteers} icon={Users} href={can('volunteers.view', 'volunteers.manage') ? '/admin/volunteers?status=ACTIVE' : undefined} />
              <StatCard label="Pending applications" value={data.counts.pendingApplications} icon={HandHeart} tone={data.counts.pendingApplications ? 'amber' : 'default'} href={can('volunteers.view', 'volunteers.manage') ? '/admin/volunteers/applications' : undefined} />
              <StatCard label="Active projects" value={data.counts.activeProjects} icon={FolderKanban} href="/admin/content/projects" />
              <StatCard label="Upcoming events" value={data.counts.upcomingEvents} icon={CalendarDays} href="/admin/content/events" />
              <StatCard label="New inquiries" value={data.counts.newInquiries} icon={Inbox} tone={data.counts.newInquiries ? 'amber' : 'default'} href={can('inquiries.manage') ? '/admin/inquiries' : undefined} />
            </div>
          </section>

          {fin && (
            <div className="grid gap-6 lg:grid-cols-5">
              <Section title="Daily donations" className="lg:col-span-3">
                {fin.trend.length === 0 ? (
                  <EmptyState icon={IndianRupee} title="No successful donations in this period">Try a wider date range.</EmptyState>
                ) : (
                  <div className="h-72" role="img" aria-label="Area chart of net donations per day">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={fin.trend.map((t) => ({ ...t, major: t.amount / 100 }))} margin={{ left: 0, right: 8, top: 8 }}>
                        <defs>
                          <linearGradient id="dashTrend" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="rgb(var(--c-primary))" stopOpacity={0.35} />
                            <stop offset="100%" stopColor="rgb(var(--c-primary))" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--c-border))" vertical={false} />
                        <XAxis dataKey="day" tickFormatter={(d: string) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} fontSize={11} stroke="rgb(var(--c-muted))" minTickGap={24} />
                        <YAxis tickFormatter={(v: number) => money(v * 100, 'INR', true)} fontSize={11} width={64} stroke="rgb(var(--c-muted))" />
                        <Tooltip formatter={(v: number) => [money(v * 100), 'Net raised']} labelFormatter={(l: string) => date(l)} contentStyle={{ borderRadius: 12, fontSize: 12 }} />
                        <Area type="monotone" dataKey="major" stroke="rgb(var(--c-primary))" strokeWidth={2} fill="url(#dashTrend)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </Section>
              <Section title="Campaign performance" className="lg:col-span-2">
                {fin.campaigns.length === 0 ? (
                  <EmptyState icon={Megaphone} title="No active campaigns" />
                ) : (
                  <div className="h-72" role="img" aria-label="Bar chart of raised versus goal for top campaigns">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart layout="vertical" data={fin.campaigns.map((c) => ({ name: c.title.length > 22 ? `${c.title.slice(0, 21)}…` : c.title, raised: c.raised / 100, goal: c.goal / 100 }))} margin={{ left: 8, right: 8 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--c-border))" horizontal={false} />
                        <XAxis type="number" tickFormatter={(v: number) => money(v * 100, 'INR', true)} fontSize={11} stroke="rgb(var(--c-muted))" />
                        <YAxis type="category" dataKey="name" width={110} fontSize={11} stroke="rgb(var(--c-muted))" />
                        <Tooltip formatter={(v: number, n: string) => [money(v * 100), n === 'raised' ? 'Raised' : 'Goal']} contentStyle={{ borderRadius: 12, fontSize: 12 }} />
                        <Legend formatter={(v: string) => (v === 'raised' ? 'Raised' : 'Goal')} wrapperStyle={{ fontSize: 12 }} />
                        <Bar dataKey="goal" fill="rgb(var(--c-border))" radius={[0, 4, 4, 0]} />
                        <Bar dataKey="raised" fill="rgb(var(--c-primary))" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </Section>
            </div>
          )}

          {!fin && (
            <div className="flex items-start gap-3 rounded-2xl border border-line bg-surface-alt/50 p-4 text-sm text-ink-muted">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> Fundraising figures are hidden because your role does not include access to donations.
            </div>
          )}

          <Section title="Recent activity" actions={can('audit.view') ? <Link to="/admin/audit" className="text-sm text-primary hover:underline">View audit log</Link> : undefined}>
            {data.recentActivity.length === 0 ? (
              <EmptyState icon={Activity} title="No activity yet" />
            ) : (
              <ul className="divide-y divide-line">
                {data.recentActivity.map((a) => (
                  <li key={a.id} className="flex items-start gap-3 py-3">
                    <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary/10 text-primary"><FileText className="h-4 w-4" aria-hidden /></span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm">
                        <strong>{a.actor}</strong> <span className="text-ink-muted">·</span> <code className="text-xs">{a.action}</code>
                        {a.summary && <span className="text-ink-muted"> — {a.summary}</span>}
                      </p>
                      <p className="text-xs text-ink-muted">{a.entityType} · {relative(a.at)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>
      )}
    </AdminPage>
  );
}
