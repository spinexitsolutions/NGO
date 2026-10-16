import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { HandCoins, Plus } from 'lucide-react';
import { toMinor } from '@ngo/shared';
import { send, qs } from '@/lib/api';
import { date, money, titleCase } from '@/lib/format';
import { useAuth } from '@/app/AuthProvider';
import { Badge, Button, Checkbox, EmptyState, Modal, StatusBadge } from '@/components/ui';
import { AdminPage, AdminSelect, DataTable, ExportButton, FilterBar, ListFooter, QueryError, SearchInput, useAdminList, type Column } from '../ui';
import { AdminField, SampleBadge, isoDay, useApiMutation, useOptions } from './_common';

export interface DonationRow {
  id: string;
  reference: string;
  amount: number;
  refundedAmount: number;
  currency: string;
  status: string;
  method: string;
  frequency: string;
  isSample: boolean;
  isAnonymous: boolean;
  createdAt: string;
  paidAt: string | null;
  donor: { name: string; email: string; phone: string };
  campaign: { title: string } | null;
  cause: { title: string } | null;
  receipts: { receiptNumber: string }[];
}

export const DONATION_STATUSES = ['PENDING', 'SUCCESS', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED', 'CANCELLED'];
export const METHODS = ['ONLINE', 'BANK_TRANSFER', 'UPI', 'CHEQUE', 'CASH', 'OTHER'];
const OFFLINE_METHODS = METHODS.filter((m) => m !== 'ONLINE');

export default function DonationsPage() {
  const { can } = useAuth();
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState(params.get('status') ?? '');
  const [method, setMethod] = useState('');
  const [frequency, setFrequency] = useState('');
  const [campaignId, setCampaignId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [recordOpen, setRecordOpen] = useState(params.get('record') === '1' && can('donations.manage'));
  const campaigns = useOptions('campaigns');

  const filters = { q: q.trim() || undefined, status, method, frequency, campaignId, from, to };
  const { rows, meta, isLoading, error, refetch, setPage } = useAdminList<DonationRow>('/admin/donations', filters, 'donations');
  const summary = (meta?.summary as { status: string; count: number; amount: number; refunded: number }[] | undefined) ?? [];
  const set = <T,>(fn: (v: T) => void) => (v: T) => {
    fn(v);
    setPage(1);
  };

  const columns: Column<DonationRow>[] = [
    { key: 'date', header: 'Date', render: (d) => <span className="whitespace-nowrap">{date(d.paidAt ?? d.createdAt)}</span> },
    {
      key: 'ref',
      header: 'Reference',
      render: (d) => (
        <span className="flex items-center gap-2 whitespace-nowrap font-mono text-xs">
          {d.reference} {d.isSample && <SampleBadge />}
        </span>
      ),
    },
    { key: 'donor', header: 'Donor', render: (d) => <div className="min-w-[10rem]"><p className="font-medium">{d.donor.name}{d.isAnonymous && <span className="ml-1 text-xs text-ink-muted">(anonymous)</span>}</p><p className="text-xs text-ink-muted">{d.donor.email}</p></div> },
    {
      key: 'amount',
      header: 'Amount',
      className: 'text-right',
      render: (d) => (
        <div className="whitespace-nowrap text-right">
          <p className="font-semibold">{money(d.amount, d.currency)}</p>
          {d.refundedAmount > 0 && <p className="text-xs text-red-700">−{money(d.refundedAmount, d.currency)} refunded</p>}
        </div>
      ),
    },
    { key: 'for', header: 'Campaign / cause', render: (d) => d.campaign?.title ?? d.cause?.title ?? <span className="text-ink-muted">General fund</span> },
    { key: 'method', header: 'Method', render: (d) => <span className="whitespace-nowrap">{titleCase(d.method)}{d.frequency === 'MONTHLY' && <Badge tone="blue" className="ml-1">Monthly</Badge>}</span> },
    { key: 'status', header: 'Status', render: (d) => <StatusBadge status={d.status} /> },
    { key: 'receipt', header: 'Receipt', render: (d) => (d.receipts[0] ? <span className="whitespace-nowrap font-mono text-xs">{d.receipts[0].receiptNumber}</span> : <span className="text-ink-muted">—</span>) },
  ];

  return (
    <AdminPage
      title="Donations"
      description="Every online and offline gift. Amounts are shown in the donation currency; refunds are listed separately."
      actions={
        <>
          {can('donations.export') && <ExportButton path={`/admin/donations${qs({ ...filters, format: 'csv' })}`} filename={`donations-${isoDay()}.csv`} />}
          {can('donations.manage') && <Button size="sm" icon={Plus} onClick={() => setRecordOpen(true)}>Record offline donation</Button>}
        </>
      }
    >
      {summary.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {summary.map((s) => (
            <button
              key={s.status}
              onClick={() => set(setStatus)(status === s.status ? '' : s.status)}
              className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition ${status === s.status ? 'border-primary bg-primary/10' : 'border-line bg-surface hover:border-primary'}`}
              aria-pressed={status === s.status}
            >
              <StatusBadge status={s.status} />
              <span className="font-semibold">{s.count.toLocaleString('en-IN')}</span>
              <span className="text-ink-muted">{money(s.amount - s.refunded)}</span>
            </button>
          ))}
        </div>
      )}
      <FilterBar>
        <SearchInput value={q} onChange={set(setQ)} placeholder="Reference, donor, email, campaign…" />
        <AdminSelect label="Status" value={status} onChange={set(setStatus)} options={[{ value: '', label: 'All statuses' }, ...DONATION_STATUSES.map((s) => ({ value: s, label: titleCase(s) }))]} />
        <AdminSelect label="Method" value={method} onChange={set(setMethod)} options={[{ value: '', label: 'All methods' }, ...METHODS.map((s) => ({ value: s, label: titleCase(s) }))]} />
        <AdminSelect label="Frequency" value={frequency} onChange={set(setFrequency)} options={[{ value: '', label: 'Any frequency' }, { value: 'ONE_TIME', label: 'One-time' }, { value: 'MONTHLY', label: 'Monthly' }]} />
        <AdminSelect label="Campaign" value={campaignId} onChange={set(setCampaignId)} options={[{ value: '', label: 'All campaigns' }, ...(campaigns.data ?? []).map((c) => ({ value: c.id, label: c.label }))]} />
        <div className="flex items-center gap-2">
          <input type="date" aria-label="From date" className="admin-input w-auto" value={from} onChange={(e) => set(setFrom)(e.target.value)} />
          <span className="text-ink-muted">–</span>
          <input type="date" aria-label="To date" className="admin-input w-auto" value={to} onChange={(e) => set(setTo)(e.target.value)} />
        </div>
      </FilterBar>
      {error ? (
        <QueryError error={error} retry={refetch} />
      ) : (
        <>
          <DataTable rows={rows} columns={columns} loading={isLoading} rowHref={(d) => `/admin/donations/${d.id}`} empty={<EmptyState icon={HandCoins} title="No donations match these filters">Clear filters or widen the date range.</EmptyState>} />
          <ListFooter meta={meta} setPage={setPage} />
        </>
      )}
      <RecordOfflineModal
        open={recordOpen}
        onClose={() => {
          setRecordOpen(false);
          if (params.get('record')) {
            params.delete('record');
            setParams(params, { replace: true });
          }
        }}
      />
    </AdminPage>
  );
}

const blankOffline = { name: '', email: '', phone: '', amount: '', method: 'BANK_TRANSFER', offlineReference: '', receivedAt: isoDay(), campaignId: '', causeId: '', notes: '', issueReceipt: true, isAnonymous: false };

function RecordOfflineModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [f, setF] = useState(blankOffline);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const campaigns = useOptions('campaigns', open);
  const causes = useOptions('causes', open);
  const upd = (k: keyof typeof blankOffline) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }));
  const save = useApiMutation(
    () =>
      send('/admin/donations/offline', {
        name: f.name,
        email: f.email,
        phone: f.phone,
        amount: toMinor(Number(f.amount)),
        method: f.method,
        offlineReference: f.offlineReference,
        receivedAt: f.receivedAt,
        campaignId: f.campaignId || null,
        causeId: f.causeId || null,
        notes: f.notes,
        issueReceipt: f.issueReceipt,
        isAnonymous: f.isAnonymous,
      }),
    {
      success: 'Offline donation recorded',
      invalidate: [['admin', 'donations'], ['admin', 'dashboard']],
      onFieldErrors: setErrors,
      onSuccess: () => {
        setF(blankOffline);
        onClose();
      },
    },
  );
  const amountValid = Number(f.amount) > 0;
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Record offline donation"
      size="lg"
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" form="offline-form" type="submit" loading={save.isPending} disabled={!amountValid}>Record donation</Button>
        </>
      }
    >
      <form
        id="offline-form"
        className="grid gap-4 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!amountValid) return setErrors({ amount: 'Enter an amount greater than zero' });
          save.mutate(undefined);
        }}
      >
        <AdminField label="Donor name" required error={errors.name}><input className="admin-input" required minLength={2} value={f.name} onChange={upd('name')} /></AdminField>
        <AdminField label="Email" required error={errors.email}><input className="admin-input" type="email" required value={f.email} onChange={upd('email')} /></AdminField>
        <AdminField label="Phone" error={errors.phone}><input className="admin-input" value={f.phone} onChange={upd('phone')} /></AdminField>
        <AdminField label="Amount (₹)" required error={errors.amount} help="Enter rupees, e.g. 2500 or 2500.50">
          <input className="admin-input" type="number" inputMode="decimal" min="0.01" step="0.01" required value={f.amount} onChange={upd('amount')} />
        </AdminField>
        <AdminField label="Payment method" required error={errors.method}>
          <select className="admin-input" value={f.method} onChange={upd('method')}>{OFFLINE_METHODS.map((m) => <option key={m} value={m}>{titleCase(m)}</option>)}</select>
        </AdminField>
        <AdminField label="Reference (UTR / UPI / cheque no.)" required error={errors.offlineReference}><input className="admin-input" required value={f.offlineReference} onChange={upd('offlineReference')} /></AdminField>
        <AdminField label="Date received" required error={errors.receivedAt}><input className="admin-input" type="date" required max={isoDay()} value={f.receivedAt} onChange={upd('receivedAt')} /></AdminField>
        <AdminField label="Campaign" error={errors.campaignId}>
          <select className="admin-input" value={f.campaignId} onChange={upd('campaignId')}>
            <option value="">— None —</option>
            {(campaigns.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </AdminField>
        <AdminField label="Cause" error={errors.causeId}>
          <select className="admin-input" value={f.causeId} onChange={upd('causeId')}>
            <option value="">— None —</option>
            {(causes.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </AdminField>
        <AdminField label="Internal notes" className="sm:col-span-2" error={errors.notes}><textarea className="admin-input min-h-[70px]" maxLength={500} value={f.notes} onChange={upd('notes')} /></AdminField>
        <div className="space-y-2 sm:col-span-2">
          <Checkbox label="Issue a tax receipt and email it to the donor" checked={f.issueReceipt} onChange={(e) => setF((x) => ({ ...x, issueReceipt: e.target.checked }))} />
          <Checkbox label="Donor wishes to remain anonymous publicly" checked={f.isAnonymous} onChange={(e) => setF((x) => ({ ...x, isAnonymous: e.target.checked }))} />
        </div>
      </form>
    </Modal>
  );
}
