import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Download, ShieldAlert } from 'lucide-react';
import { download, get, send } from '@/lib/api';
import { date, dateTime, money } from '@/lib/format';
import { useAuth } from '@/app/AuthProvider';
import { Badge, Button, Checkbox, StatusBadge, useConfirm, useToast } from '@/components/ui';
import { AdminPage, QueryError, StatCard } from '../ui';
import { AdminField, LoadingBlock, NotesPanel, Section, errorMessage, useApiMutation, type InternalNote } from './_common';

interface DonorDetail {
  id: string;
  name: string;
  email: string;
  phone: string;
  pan: string;
  address: string;
  marketingOptIn: boolean;
  marketingConsentAt: string | null;
  doNotContact: boolean;
  createdAt: string;
  donations: {
    id: string;
    reference: string;
    amount: number;
    refundedAmount: number;
    currency: string;
    status: string;
    frequency: string;
    method: string;
    isSample: boolean;
    paidAt: string | null;
    createdAt: string;
    campaign: { title: string } | null;
    receipts: { id: string; receiptNumber: string; status: string }[];
  }[];
  recurring: { id: string; reference: string; amount: number; currency: string; status: string; createdAt: string }[];
  notes: InternalNote[];
}

export default function DonorDetailPage() {
  const { id = '' } = useParams();
  const { can } = useAuth();
  const confirm = useConfirm();
  const toast = useToast();
  const navigate = useNavigate();
  const key = ['admin', 'donor', id];
  const { data: d, isLoading, error, refetch } = useQuery({ queryKey: key, queryFn: () => get<DonorDetail>(`/admin/donors/${id}`) });
  const manage = can('donations.manage');

  const [prefs, setPrefs] = useState({ name: '', phone: '', address: '', pan: '', marketingOptIn: false, doNotContact: false });
  const [errors, setErrors] = useState<Record<string, string>>({});
  useEffect(() => {
    if (d) setPrefs({ name: d.name, phone: d.phone, address: d.address, pan: d.pan, marketingOptIn: d.marketingOptIn, doNotContact: d.doNotContact });
  }, [d]);

  const save = useApiMutation(() => send(`/admin/donors/${id}/preferences`, prefs, 'PUT'), { success: 'Donor updated', invalidate: [key, ['admin', 'donors']], onFieldErrors: setErrors });
  const erase = useApiMutation((reason: string) => send(`/admin/donors/${id}/anonymise`, { confirm: true, reason }), {
    success: 'Personal data erased. Financial records were kept in anonymised form.',
    invalidate: [key, ['admin', 'donors'], ['admin', 'donations']],
  });
  const [eraseReason, setEraseReason] = useState('');

  if (error) return <AdminPage title="Donor" back={{ href: '/admin/donors', label: 'Donors' }}><QueryError error={error} retry={refetch} /></AdminPage>;
  if (isLoading || !d) return <AdminPage title="Donor" back={{ href: '/admin/donors', label: 'Donors' }}><LoadingBlock /></AdminPage>;

  const counted = d.donations.filter((x) => ['SUCCESS', 'PARTIALLY_REFUNDED'].includes(x.status));
  const total = counted.reduce((n, x) => n + x.amount - x.refundedAmount, 0);
  const receipts = d.donations.flatMap((x) => x.receipts.map((r) => ({ ...r, donation: x })));
  const erased = d.email.endsWith('@invalid.local');

  return (
    <AdminPage title={d.name} description={`Donor since ${date(d.createdAt)}`} back={{ href: '/admin/donors', label: 'Donors' }}>
      {erased && <p className="mb-4 rounded-xl border border-line bg-surface-alt p-3 text-sm text-ink-muted">This donor’s personal data has been erased. Donation records are kept for financial reporting.</p>}
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Total given (net)" value={money(total)} hint="Successful donations only" />
        <StatCard label="Successful gifts" value={counted.length} />
        <StatCard label="Active monthly plans" value={d.recurring.filter((r) => r.status === 'ACTIVE').length} />
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Section title="Giving history">
            {d.donations.length === 0 ? (
              <p className="text-sm text-ink-muted">No donations.</p>
            ) : (
              <div className="-mx-5 overflow-x-auto">
                <table className="table-base">
                  <thead><tr><th>Date</th><th>Reference</th><th>Campaign</th><th className="text-right">Amount</th><th>Status</th></tr></thead>
                  <tbody>
                    {d.donations.map((x) => (
                      <tr key={x.id}>
                        <td className="whitespace-nowrap">{date(x.paidAt ?? x.createdAt)}</td>
                        <td><Link className="font-mono text-xs text-primary hover:underline" to={`/admin/donations/${x.id}`}>{x.reference}</Link>{x.frequency === 'MONTHLY' && <Badge tone="blue" className="ml-1">Monthly</Badge>}</td>
                        <td>{x.campaign?.title ?? <span className="text-ink-muted">General</span>}</td>
                        <td className="whitespace-nowrap text-right">{money(x.amount, x.currency)}{x.refundedAmount > 0 && <span className="block text-xs text-red-700">−{money(x.refundedAmount, x.currency)}</span>}</td>
                        <td><StatusBadge status={x.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>

          {d.recurring.length > 0 && (
            <Section title="Monthly giving" actions={<Link to="/admin/recurring" className="text-sm text-primary hover:underline">All plans</Link>}>
              <ul className="divide-y divide-line">
                {d.recurring.map((r) => (
                  <li key={r.id} className="flex items-center justify-between py-2 text-sm">
                    <span className="font-mono text-xs">{r.reference}</span>
                    <span>{money(r.amount, r.currency)}/month</span>
                    <StatusBadge status={r.status} />
                  </li>
                ))}
              </ul>
            </Section>
          )}

          <Section title="Receipts">
            {receipts.length === 0 ? (
              <p className="text-sm text-ink-muted">No receipts issued.</p>
            ) : (
              <ul className="divide-y divide-line">
                {receipts.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <span className="text-sm"><span className="font-mono">{r.receiptNumber}</span> <StatusBadge status={r.status} /> <span className="text-xs text-ink-muted">· {money(r.donation.amount, r.donation.currency)}</span></span>
                    <Button
                      size="sm"
                      variant="outline"
                      icon={Download}
                      onClick={() => download(`/admin/donations/receipts/${r.id}/pdf`, `receipt-${r.receiptNumber.replace(/\//g, '-')}.pdf`).catch((e) => toast(errorMessage(e, 'Download failed'), 'error'))}
                    >
                      PDF
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>

        <div className="space-y-6">
          <Section title="Profile & preferences">
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                save.mutate(undefined);
              }}
            >
              <p className="text-sm"><span className="admin-label">Email</span><a href={`mailto:${d.email}`} className="break-all text-primary hover:underline">{d.email}</a></p>
              <AdminField label="Name" error={errors.name}><input className="admin-input" disabled={!manage} minLength={2} required value={prefs.name} onChange={(e) => setPrefs({ ...prefs, name: e.target.value })} /></AdminField>
              <AdminField label="Phone" error={errors.phone}><input className="admin-input" disabled={!manage} maxLength={20} value={prefs.phone} onChange={(e) => setPrefs({ ...prefs, phone: e.target.value })} /></AdminField>
              <AdminField label="PAN" error={errors.pan}><input className="admin-input uppercase" disabled={!manage} maxLength={10} value={prefs.pan} onChange={(e) => setPrefs({ ...prefs, pan: e.target.value.toUpperCase() })} /></AdminField>
              <AdminField label="Address" error={errors.address}><textarea className="admin-input min-h-[70px]" disabled={!manage} maxLength={300} value={prefs.address} onChange={(e) => setPrefs({ ...prefs, address: e.target.value })} /></AdminField>
              <Checkbox disabled={!manage} label={<>Marketing emails opt-in{d.marketingConsentAt && <span className="block text-xs text-ink-muted">Consent recorded {dateTime(d.marketingConsentAt)}</span>}</>} checked={prefs.marketingOptIn} onChange={(e) => setPrefs({ ...prefs, marketingOptIn: e.target.checked })} />
              <Checkbox disabled={!manage} label="Do not contact (suppress all non-essential email)" checked={prefs.doNotContact} onChange={(e) => setPrefs({ ...prefs, doNotContact: e.target.checked })} />
              {manage && <Button size="sm" type="submit" loading={save.isPending}>Save changes</Button>}
            </form>
          </Section>

          <NotesPanel entityType="Donor" entityId={d.id} notes={d.notes} invalidate={key} />

          {manage && !erased && (
            <section className="admin-card border-red-200">
              <h2 className="flex items-center gap-2 font-heading text-lg text-red-800"><ShieldAlert className="h-5 w-5" aria-hidden /> Erase personal data</h2>
              <p className="mt-1 text-sm text-ink-muted">For data-erasure requests. Name, email, phone, PAN and address are permanently removed; donation amounts stay for financial records.</p>
              <AdminField label="Reason for erasure" className="mt-3" help="e.g. “Donor request by email on 12 March”. Minimum 5 characters.">
                <input className="admin-input" maxLength={300} value={eraseReason} onChange={(e) => setEraseReason(e.target.value)} />
              </AdminField>
              <Button
                size="sm"
                variant="danger"
                className="mt-3"
                disabled={eraseReason.trim().length < 5}
                loading={erase.isPending}
                onClick={async () => {
                  const ok = await confirm({
                    title: 'Erase this donor’s personal data?',
                    danger: true,
                    confirmLabel: 'Erase permanently',
                    typeToConfirm: 'ERASE',
                    message: `All personal details for ${d.name} will be permanently removed. This cannot be undone.`,
                  });
                  if (ok) erase.mutate(eraseReason.trim(), { onSuccess: () => navigate('/admin/donors') });
                }}
              >
                Erase personal data
              </Button>
            </section>
          )}
        </div>
      </div>
    </AdminPage>
  );
}
