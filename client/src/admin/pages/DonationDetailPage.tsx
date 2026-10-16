import { useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Ban, Download, FileText, Mail, Receipt as ReceiptIcon, RotateCcw } from 'lucide-react';
import { toMinor, toMajor } from '@ngo/shared';
import { download, get, send } from '@/lib/api';
import { date, dateTime, money, titleCase } from '@/lib/format';
import { useAuth } from '@/app/AuthProvider';
import { Badge, Button, Checkbox, Modal, StatusBadge, useConfirm, useToast } from '@/components/ui';
import { AdminPage, DetailList, QueryError } from '../ui';
import { AdminField, LoadingBlock, NotesPanel, SampleBadge, Section, errorMessage, useApiMutation, type InternalNote } from './_common';

interface Receipt { id: string; receiptNumber: string; status: string; issuedAt: string; emailedAt: string | null; voidedAt: string | null; voidReason: string; replacesId: string | null }
interface DonationDetail {
  id: string;
  reference: string;
  amount: number;
  refundedAmount: number;
  currency: string;
  status: string;
  method: string;
  frequency: string;
  isOffline: boolean;
  isAnonymous: boolean;
  isSample: boolean;
  message: string;
  provider: string;
  providerOrderId: string | null;
  providerPaymentId: string | null;
  offlineReference: string;
  failureReason: string;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  referrer: string;
  paidAt: string | null;
  createdAt: string;
  donor: { id: string; name: string; email: string; phone: string; pan: string; address: string; marketingOptIn: boolean; doNotContact: boolean };
  campaign: { id: string; title: string } | null;
  cause: { id: string; title: string } | null;
  event: { id: string; title: string } | null;
  transactions: { id: string; provider: string; type: string; providerRef: string; amount: number; status: string; createdAt: string }[];
  refunds: { id: string; amount: number; reason: string; status: string; providerRefundId: string | null; createdAt: string }[];
  receipts: Receipt[];
  recurring: { id: string; reference: string; status: string } | null;
  notes: InternalNote[];
}

export default function DonationDetailPage() {
  const { id = '' } = useParams();
  const { can } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const key = ['admin', 'donation', id];
  const { data: d, isLoading, error, refetch } = useQuery({ queryKey: key, queryFn: () => get<DonationDetail>(`/admin/donations/${id}`) });
  const [refundOpen, setRefundOpen] = useState(false);
  const [voiding, setVoiding] = useState<Receipt | null>(null);
  const manage = can('donations.manage');
  const inv = [key, ['admin', 'donations'], ['admin', 'dashboard']];

  const issue = useApiMutation(() => send(`/admin/donations/${id}/receipt`), { success: 'Receipt issued', invalidate: inv });
  const emailAgain = useApiMutation((rid: string) => send<{ ok: boolean }>(`/admin/donations/receipts/${rid}/email`), {
    success: (r) => (r.ok ? 'Receipt emailed to the donor' : 'Email could not be sent — check the email log'),
    invalidate: [key],
  });

  if (error) return <AdminPage title="Donation" back={{ href: '/admin/donations', label: 'Donations' }}><QueryError error={error} retry={refetch} /></AdminPage>;
  if (isLoading || !d) return <AdminPage title="Donation" back={{ href: '/admin/donations', label: 'Donations' }}><LoadingBlock /></AdminPage>;

  const net = d.amount - d.refundedAmount;
  const refundable = ['SUCCESS', 'PARTIALLY_REFUNDED'].includes(d.status) ? net : 0;
  const activeReceipt = d.receipts.find((r) => r.status === 'ISSUED');
  const canIssue = manage && !activeReceipt && ['SUCCESS', 'PARTIALLY_REFUNDED'].includes(d.status);

  const pdf = async (r: Receipt) => {
    try {
      await download(`/admin/donations/receipts/${r.id}/pdf`, `receipt-${r.receiptNumber.replace(/\//g, '-')}.pdf`);
    } catch (e) {
      toast(errorMessage(e, 'Download failed'), 'error');
    }
  };

  return (
    <AdminPage
      title={<span className="flex flex-wrap items-center gap-3"><span className="font-mono text-2xl">{d.reference}</span><StatusBadge status={d.status} />{d.isSample && <SampleBadge />}</span>}
      description={`${d.isOffline ? 'Offline' : 'Online'} ${d.frequency === 'MONTHLY' ? 'monthly' : 'one-time'} donation · created ${dateTime(d.createdAt)}`}
      back={{ href: '/admin/donations', label: 'Donations' }}
      actions={
        <>
          {canIssue && <Button size="sm" variant="outline" icon={ReceiptIcon} loading={issue.isPending} onClick={() => issue.mutate(undefined)}>Issue receipt</Button>}
          {manage && refundable > 0 && <Button size="sm" variant="danger" icon={RotateCcw} onClick={() => setRefundOpen(true)}>Refund</Button>}
        </>
      }
    >
      {d.isSample && <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">This is sample data created by the seed script. It is included in lists but should be removed before going live.</p>}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="admin-card"><p className="admin-label">Amount</p><p className="font-heading text-2xl">{money(d.amount, d.currency)}</p></div>
            <div className="admin-card"><p className="admin-label">Refunded</p><p className={`font-heading text-2xl ${d.refundedAmount ? 'text-red-700' : ''}`}>{money(d.refundedAmount, d.currency)}</p></div>
            <div className="admin-card"><p className="admin-label">Net</p><p className="font-heading text-2xl">{money(net, d.currency)}</p></div>
          </div>

          <Section title="Payment details">
            <DetailList
              items={[
                ['Status', <StatusBadge key="s" status={d.status} />],
                ['Paid at', dateTime(d.paidAt)],
                ['Method', titleCase(d.method)],
                ['Provider', d.provider || (d.isOffline ? 'Offline' : '')],
                ['Payment ID', d.providerPaymentId && <code key="p" className="text-xs">{d.providerPaymentId}</code>],
                ['Order ID', d.providerOrderId && <code key="o" className="text-xs">{d.providerOrderId}</code>],
                ['Offline reference', d.offlineReference],
                ['Recurring plan', d.recurring && <span key="r">{d.recurring.reference} <StatusBadge status={d.recurring.status} /></span>],
                ...(d.failureReason ? ([['Failure reason', <span key="f" className="text-red-700">{d.failureReason}</span>]] as [string, ReactNode][]) : []),
                ...(d.message ? ([['Donor message', <q key="m">{d.message}</q>]] as [string, ReactNode][]) : []),
              ]}
            />
          </Section>

          <Section title="Attribution">
            <DetailList
              items={[
                ['Campaign', d.campaign && <Link key="c" className="text-primary hover:underline" to={`/admin/content/campaigns/${d.campaign.id}`}>{d.campaign.title}</Link>],
                ['Cause', d.cause && <Link key="ca" className="text-primary hover:underline" to={`/admin/content/causes/${d.cause.id}`}>{d.cause.title}</Link>],
                ['Event', d.event && <Link key="e" className="text-primary hover:underline" to={`/admin/content/events/${d.event.id}`}>{d.event.title}</Link>],
                ['UTM source / medium', [d.utmSource, d.utmMedium].filter(Boolean).join(' / ')],
                ['UTM campaign', d.utmCampaign],
                ['Referrer', d.referrer && <span key="ref" className="break-all">{d.referrer}</span>],
              ]}
            />
          </Section>

          <Section title="Payment ledger">
            {d.transactions.length === 0 ? (
              <p className="text-sm text-ink-muted">No provider events recorded.</p>
            ) : (
              <ol className="relative space-y-4 border-l border-line pl-5">
                {d.transactions.map((t) => (
                  <li key={t.id} className="relative">
                    <span className={`absolute -left-[26px] top-1 h-3 w-3 rounded-full border-2 border-surface ${/FAIL/.test(t.type) || /fail/i.test(t.status) ? 'bg-red-600' : /REFUND/.test(t.type) ? 'bg-amber-500' : 'bg-emerald-600'}`} aria-hidden />
                    <p className="text-sm font-medium">{titleCase(t.type)} <span className="text-ink-muted">· {money(t.amount, d.currency)}</span></p>
                    <p className="text-xs text-ink-muted">{dateTime(t.createdAt)} · {t.provider} · {t.status}{t.providerRef && <> · <code>{t.providerRef}</code></>}</p>
                  </li>
                ))}
              </ol>
            )}
          </Section>

          {d.refunds.length > 0 && (
            <Section title="Refunds">
              <ul className="divide-y divide-line">
                {d.refunds.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-start justify-between gap-2 py-3">
                    <div>
                      <p className="text-sm font-medium">{money(r.amount, d.currency)} <StatusBadge status={r.status} /></p>
                      <p className="text-xs text-ink-muted">{r.reason}</p>
                    </div>
                    <p className="text-xs text-ink-muted">{dateTime(r.createdAt)}{r.providerRefundId && <> · <code>{r.providerRefundId}</code></>}</p>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          <Section title="Receipts" actions={canIssue ? <Button size="sm" variant="outline" icon={ReceiptIcon} loading={issue.isPending} onClick={() => issue.mutate(undefined)}>Issue receipt</Button> : undefined}>
            {d.receipts.length === 0 ? (
              <p className="text-sm text-ink-muted">{['SUCCESS', 'PARTIALLY_REFUNDED'].includes(d.status) ? 'No receipt has been issued yet.' : 'Receipts are issued only for successful donations.'}</p>
            ) : (
              <ul className="divide-y divide-line">
                {d.receipts.map((r) => (
                  <li key={r.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="flex items-center gap-2 text-sm font-medium"><FileText className="h-4 w-4 text-ink-muted" aria-hidden /><span className="font-mono">{r.receiptNumber}</span> <StatusBadge status={r.status} /></p>
                      <p className="text-xs text-ink-muted">
                        Issued {dateTime(r.issuedAt)}
                        {r.emailedAt && ` · emailed ${dateTime(r.emailedAt)}`}
                        {r.voidedAt && ` · voided ${dateTime(r.voidedAt)}: ${r.voidReason}`}
                        {r.replacesId && ' · correction of a voided receipt'}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" icon={Download} onClick={() => pdf(r)}>PDF</Button>
                      {manage && r.status === 'ISSUED' && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            icon={Mail}
                            loading={emailAgain.isPending && emailAgain.variables === r.id}
                            onClick={async () => {
                              if (await confirm({ title: 'Email receipt again?', message: `The receipt will be sent to ${d.donor.email}.`, confirmLabel: 'Send email' })) emailAgain.mutate(r.id);
                            }}
                          >
                            Email again
                          </Button>
                          <Button size="sm" variant="outline" icon={Ban} className="text-red-700" onClick={() => setVoiding(r)}>Void</Button>
                        </>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>

        <div className="space-y-6">
          <Section title="Donor" actions={<Link to={`/admin/donors/${d.donor.id}`} className="text-sm text-primary hover:underline">View donor</Link>}>
            <p className="font-medium">{d.donor.name} {d.isAnonymous && <Badge>Anonymous publicly</Badge>}</p>
            <p className="text-sm"><a className="text-primary hover:underline" href={`mailto:${d.donor.email}`}>{d.donor.email}</a></p>
            {d.donor.phone && <p className="text-sm"><a className="hover:underline" href={`tel:${d.donor.phone}`}>{d.donor.phone}</a></p>}
            {d.donor.pan && <p className="mt-2 text-xs text-ink-muted">PAN on file: {d.donor.pan}</p>}
            {d.donor.address && <p className="mt-1 whitespace-pre-line text-xs text-ink-muted">{d.donor.address}</p>}
            <div className="mt-3 flex flex-wrap gap-1">
              {d.donor.marketingOptIn && <Badge tone="green">Marketing opt-in</Badge>}
              {d.donor.doNotContact && <Badge tone="red">Do not contact</Badge>}
            </div>
          </Section>
          <NotesPanel entityType="Donation" entityId={d.id} notes={d.notes} invalidate={key} />
        </div>
      </div>

      <RefundModal open={refundOpen} onClose={() => setRefundOpen(false)} donation={d} refundable={refundable} invalidate={inv} />
      <VoidModal receipt={voiding} onClose={() => setVoiding(null)} donor={d.donor} invalidate={inv} />
    </AdminPage>
  );
}

function RefundModal({ open, onClose, donation, refundable, invalidate }: { open: boolean; onClose: () => void; donation: DonationDetail; refundable: number; invalidate: unknown[][] }) {
  const confirm = useConfirm();
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const refund = useApiMutation((body: { amount: number; reason: string }) => send(`/admin/donations/${donation.id}/refund`, { ...body, confirm: true }), {
    success: 'Refund recorded',
    invalidate,
    onFieldErrors: setErrors,
    onSuccess: () => {
      setAmount('');
      setReason('');
      onClose();
    },
  });
  const minor = toMinor(Number(amount) || 0, donation.currency);
  const invalidAmount = minor <= 0 || minor > refundable;
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Refund donation"
      size="sm"
      footer={
        <>
          <Button size="sm" variant="outline" onClick={onClose}>Cancel</Button>
          <Button size="sm" variant="danger" form="refund-form" type="submit" loading={refund.isPending} disabled={invalidAmount || reason.trim().length < 3}>Refund</Button>
        </>
      }
    >
      <form
        id="refund-form"
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          if (invalidAmount) return setErrors({ amount: `Enter an amount up to ${money(refundable, donation.currency)}` });
          const ok = await confirm({
            title: 'Confirm refund',
            danger: true,
            confirmLabel: `Refund ${money(minor, donation.currency)}`,
            message: donation.isOffline ? 'This records a refund for an offline donation. Make sure the money has actually been returned to the donor.' : 'The refund will be sent to the payment provider and cannot be undone.',
          });
          if (ok) refund.mutate({ amount: minor, reason: reason.trim() });
        }}
      >
        <p className="text-sm text-ink-muted">Refundable: <strong className="text-ink">{money(refundable, donation.currency)}</strong></p>
        <AdminField label={`Amount (${donation.currency})`} required error={errors.amount}>
          <div className="flex gap-2">
            <input className="admin-input" type="number" min="0.01" step="0.01" max={toMajor(refundable, donation.currency)} required value={amount} onChange={(e) => setAmount(e.target.value)} />
            <Button type="button" size="sm" variant="outline" onClick={() => setAmount(String(toMajor(refundable, donation.currency)))}>Full</Button>
          </div>
        </AdminField>
        <AdminField label="Reason" required error={errors.reason} help="Kept in the audit log.">
          <textarea className="admin-input min-h-[80px]" minLength={3} maxLength={300} required value={reason} onChange={(e) => setReason(e.target.value)} />
        </AdminField>
      </form>
    </Modal>
  );
}

function VoidModal({ receipt, onClose, donor, invalidate }: { receipt: Receipt | null; onClose: () => void; donor: DonationDetail['donor']; invalidate: unknown[][] }) {
  const confirm = useConfirm();
  const [reason, setReason] = useState('');
  const [correct, setCorrect] = useState(false);
  const [c, setC] = useState({ name: donor.name, address: donor.address, pan: donor.pan });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const voidIt = useApiMutation(() => send(`/admin/donations/receipts/${receipt?.id}/void`, { reason: reason.trim(), confirm: true, correction: correct ? c : null }), {
    success: correct ? 'Receipt voided and a corrected receipt issued' : 'Receipt voided',
    invalidate,
    onFieldErrors: setErrors,
    onSuccess: () => {
      setReason('');
      setCorrect(false);
      onClose();
    },
  });
  return (
    <Modal
      open={Boolean(receipt)}
      onClose={onClose}
      title={`Void receipt ${receipt?.receiptNumber ?? ''}`}
      footer={
        <>
          <Button size="sm" variant="outline" onClick={onClose}>Cancel</Button>
          <Button size="sm" variant="danger" form="void-form" type="submit" loading={voidIt.isPending} disabled={reason.trim().length < 5}>Void receipt</Button>
        </>
      }
    >
      <form
        id="void-form"
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          const ok = await confirm({ title: 'Void this receipt?', danger: true, confirmLabel: 'Void receipt', message: 'Voided receipts stay on record for audit but are no longer valid for tax purposes. This cannot be undone.' });
          if (ok) voidIt.mutate(undefined);
        }}
      >
        <AdminField label="Reason" required error={errors.reason} help="At least 5 characters.">
          <textarea className="admin-input min-h-[70px]" minLength={5} maxLength={300} required value={reason} onChange={(e) => setReason(e.target.value)} />
        </AdminField>
        <Checkbox label="Issue a corrected receipt with updated donor details" checked={correct} onChange={(e) => setCorrect(e.target.checked)} />
        {correct && (
          <div className="grid gap-3 rounded-xl bg-surface-alt/50 p-3 sm:grid-cols-2">
            <AdminField label="Name" required error={errors['correction.name']}><input className="admin-input" minLength={2} required value={c.name} onChange={(e) => setC({ ...c, name: e.target.value })} /></AdminField>
            <AdminField label="PAN" error={errors['correction.pan']}><input className="admin-input uppercase" maxLength={10} value={c.pan} onChange={(e) => setC({ ...c, pan: e.target.value.toUpperCase() })} /></AdminField>
            <AdminField label="Address" className="sm:col-span-2" error={errors['correction.address']}><textarea className="admin-input min-h-[60px]" maxLength={300} value={c.address} onChange={(e) => setC({ ...c, address: e.target.value })} /></AdminField>
          </div>
        )}
      </form>
    </Modal>
  );
}
