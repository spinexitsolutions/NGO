import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { z } from 'zod';
import { QRCodeSVG } from 'qrcode.react';
import { AlertTriangle, BadgeCheck, Building2, CalendarDays, Copy, FlaskConical, Heart, Landmark, Lock, Mail, Receipt, Repeat, ShieldCheck, Smartphone } from 'lucide-react';
import { donationCheckoutSchema } from '@ngo/shared';
import { useSite } from '@/app/SiteProvider';
import { ApiError, send } from '@/lib/api';
import { cn } from '@/lib/cn';
import { money } from '@/lib/format';
import { useCollection, usePublic } from '@/lib/queries';
import type { Campaign, Cause, EventItem } from '@/lib/types';
import { Badge, Button, Checkbox, Field, Honeypot, Input, Modal, Select, Textarea, useToast } from '@/components/ui';
import { ProgressBar, Reveal } from '@/components/site/motion';
import { SampleBadge } from '@/components/site/SampleBadge';
import { SmartImage } from '@/components/site/SmartImage';
import { CmsPage } from './CmsPage';
import { readSession, writeSession } from './page-kit';

// ─── Types ───────────────────────────────────────────────────────────────────────

interface CheckoutResponse {
  reference: string;
  provider: 'razorpay' | 'sandbox';
  key: string;
  amount: number;
  currency: string;
  frequency: 'ONE_TIME' | 'MONTHLY';
  orderId?: string;
  subscriptionId?: string;
  name: string;
  prefill: { name: string; email: string; contact: string };
}
interface VerifyPayload { reference: string; paymentId: string; signature: string; orderId?: string; subscriptionId?: string }
interface RazorpaySuccess { razorpay_payment_id: string; razorpay_signature: string; razorpay_order_id?: string; razorpay_subscription_id?: string }
interface RazorpayInstance { open(): void; on(event: 'payment.failed', cb: (r: { error?: { description?: string; reason?: string } }) => void): void }
type RazorpayCtor = new (options: Record<string, unknown>) => RazorpayInstance;
type Utm = { source?: string; medium?: string; campaign?: string; referrer?: string };

const donorSchema = donationCheckoutSchema.pick({ name: true, email: true, phone: true, pan: true, address: true, isAnonymous: true, message: true, marketingOptIn: true, website: true });
type DonorValues = z.input<typeof donorSchema>;

const UTM_KEY = 'ngo_utm';
const RAZORPAY_SRC = 'https://checkout.razorpay.com/v1/checkout.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────────

let razorpayPromise: Promise<RazorpayCtor> | null = null;
function loadRazorpay(): Promise<RazorpayCtor> {
  const existing = (window as unknown as { Razorpay?: RazorpayCtor }).Razorpay;
  if (existing) return Promise.resolve(existing);
  if (!razorpayPromise) {
    razorpayPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = RAZORPAY_SRC;
      s.async = true;
      s.onload = () => {
        const R = (window as unknown as { Razorpay?: RazorpayCtor }).Razorpay;
        if (R) resolve(R);
        else reject(new Error('Payment window unavailable'));
      };
      s.onerror = () => {
        razorpayPromise = null;
        s.remove();
        reject(new Error('Could not load the payment window. Please check your connection and try again.'));
      };
      document.body.appendChild(s);
    });
  }
  return razorpayPromise;
}

/** Reads utm_* params from the URL (persisting them for this tab) or from an earlier page in the session. */
function useUtm(params: URLSearchParams): Utm {
  return useMemo(() => {
    const fromUrl: Utm = {};
    (['source', 'medium', 'campaign'] as const).forEach((k) => {
      const v = params.get(`utm_${k}`);
      if (v) fromUrl[k] = v.slice(0, 100);
    });
    const referrer = typeof document !== 'undefined' && document.referrer && !document.referrer.startsWith(window.location.origin) ? document.referrer.slice(0, 300) : undefined;
    if (Object.keys(fromUrl).length) {
      const utm = { ...fromUrl, referrer };
      writeSession(UTM_KEY, JSON.stringify(utm));
      return utm;
    }
    try {
      const stored = readSession(UTM_KEY);
      if (stored) return JSON.parse(stored) as Utm;
    } catch {
      /* ignore malformed */
    }
    return referrer ? { referrer } : {};
  }, [params]);
}

const major = (minor: number) => minor / 100;

function StepHeading({ n, title, hint }: { n: number; title: string; hint?: ReactNode }) {
  return (
    <div className="mb-5 flex items-start gap-3">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary text-sm font-semibold text-primary-contrast" aria-hidden>{n}</span>
      <div>
        <h2 className="font-heading text-2xl leading-tight">{title}</h2>
        {hint && <p className="mt-1 text-sm text-ink-muted">{hint}</p>}
      </div>
    </div>
  );
}

// ─── Side panels ────────────────────────────────────────────────────────────────

function CampaignContext({ c }: { c: Campaign }) {
  return (
    <div className="card overflow-hidden">
      <div className="relative aspect-[16/9]">
        <SmartImage src={c.coverImage} alt={c.coverAlt || c.title} sizes="(min-width:1024px) 380px, 100vw" width={800} />
        <SampleBadge show={c.isSample} className="absolute right-3 top-3" />
      </div>
      <div className="p-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-accent">You’re supporting</p>
        <Link to={`/campaigns/${c.slug}`} className="mt-1 block font-heading text-xl leading-snug hover:text-primary">{c.title}</Link>
        <ProgressBar percent={c.percent} className="mt-4" label={`${c.percent}% of goal raised`} />
        <p className="mt-2 text-sm text-ink-muted">
          <strong className="text-ink">{money(c.raised, c.currency)}</strong> of {money(c.goalAmount, c.currency)} · {c.donors} supporters
        </p>
        {c.phase !== 'active' && (
          <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-900/30 dark:text-amber-100" role="note">
            {c.phase === 'upcoming' ? 'This campaign hasn’t opened yet' : 'This campaign has closed'}, so your gift will support our work where it’s needed most.
          </p>
        )}
      </div>
    </div>
  );
}

function CopyRow({ label, value }: { label: string; value: string }) {
  const toast = useToast();
  if (!value) return null;
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="flex min-w-0 items-center gap-2 font-medium text-ink">
        <span className="truncate font-mono text-[0.85rem]">{value}</span>
        <button
          type="button"
          className="rounded-md p-1 text-ink-muted hover:bg-ink/5 hover:text-primary"
          aria-label={`Copy ${label}`}
          onClick={() => navigator.clipboard?.writeText(value).then(() => toast(`${label} copied`, 'info')).catch(() => undefined)}
        >
          <Copy className="h-3.5 w-3.5" aria-hidden />
        </button>
      </dd>
    </div>
  );
}

function OfflineOptions() {
  const { settings } = useSite();
  const bank = settings.donation.bankTransfer;
  const upi = settings.donation.upi;
  if (!bank.enabled && !upi.enabled) return null;
  const upiUrl = upi.enabled && upi.vpa ? `upi://pay?pa=${encodeURIComponent(upi.vpa)}&pn=${encodeURIComponent(upi.payeeName || settings.organization.name)}&cu=INR` : '';
  return (
    <div className="card p-6">
      <h2 className="font-heading text-xl">Other ways to give</h2>
      {upi.enabled && upi.vpa && (
        <div className="mt-5">
          <p className="flex items-center gap-2 text-sm font-semibold"><Smartphone className="h-4 w-4 text-primary" aria-hidden /> Pay by UPI</p>
          <div className="mt-3 flex items-center gap-4">
            <div className="shrink-0 rounded-xl bg-white p-2.5 shadow-sm ring-1 ring-line">
              <QRCodeSVG value={upiUrl} size={112} level="M" aria-label={`UPI QR code for ${upi.vpa}`} role="img" />
            </div>
            <dl className="min-w-0 flex-1 text-sm">
              <CopyRow label="UPI ID" value={upi.vpa} />
              {upi.payeeName && <p className="text-xs text-ink-muted">{upi.payeeName}</p>}
              <p className="mt-2 text-xs text-ink-muted">Scan with any UPI app. Email us your transaction ID for a receipt.</p>
            </dl>
          </div>
        </div>
      )}
      {bank.enabled && (
        <div className={cn('mt-5', upi.enabled && 'border-t border-line pt-5')}>
          <p className="flex items-center gap-2 text-sm font-semibold"><Landmark className="h-4 w-4 text-primary" aria-hidden /> Bank transfer</p>
          <dl className="mt-2 divide-y divide-line text-sm">
            <CopyRow label="Account name" value={bank.accountName} />
            <CopyRow label="Account no." value={bank.accountNumber} />
            <CopyRow label="IFSC" value={bank.ifsc} />
            <CopyRow label="Bank" value={[bank.bankName, bank.branch].filter(Boolean).join(', ')} />
          </dl>
          {bank.notes && <p className="mt-2 text-xs text-ink-muted">{bank.notes}</p>}
        </div>
      )}
    </div>
  );
}

function TrustPanel() {
  const { settings } = useSite();
  const reg = settings.registration;
  const showTax = reg.verified && reg.taxExemptionEnabled && reg.taxExemptionText;
  const items = [
    { icon: Lock, title: 'Secure payment', text: 'Encrypted checkout through a trusted payment gateway. We never see or store your card details.' },
    { icon: Mail, title: 'Instant receipt', text: 'A receipt is emailed to you as soon as your payment is confirmed.' },
    { icon: ShieldCheck, title: 'Your privacy', text: 'We never sell or share your details.' },
  ];
  return (
    <div className="card p-6">
      <ul className="space-y-5">
        {items.map(({ icon: I, title, text }) => (
          <li key={title} className="flex gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/10 text-primary"><I className="h-4 w-4" aria-hidden /></span>
            <div>
              <p className="text-sm font-semibold text-ink">{title}</p>
              <p className="text-sm text-ink-muted">{text}</p>
            </div>
          </li>
        ))}
      </ul>
      {reg.verified && (reg.legalName || reg.registrationNumber) && (
        <div className="mt-6 border-t border-line pt-5 text-sm">
          <p className="flex items-center gap-2 font-semibold text-ink"><BadgeCheck className="h-4 w-4 text-primary" aria-hidden /> Registered organisation</p>
          <p className="mt-1 text-ink-muted">{[reg.legalName, reg.registrationType, reg.registrationNumber && `Reg. no. ${reg.registrationNumber}`].filter(Boolean).join(' · ')}</p>
        </div>
      )}
      {showTax && (
        <div className="mt-5 rounded-xl bg-primary/5 p-4 text-sm text-ink">
          <p className="flex items-center gap-2 font-semibold"><Receipt className="h-4 w-4 text-primary" aria-hidden /> Tax benefit</p>
          <p className="mt-1 text-ink-muted">{reg.taxExemptionText}</p>
        </div>
      )}
    </div>
  );
}

// ─── Checkout ───────────────────────────────────────────────────────────────────

function Checkout() {
  const { settings, theme } = useSite();
  const d = settings.donation;
  const currency = d.currency;
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const utm = useUtm(params);
  const campaignSlug = params.get('campaign') ?? '';
  const eventSlug = params.get('event') ?? '';
  const amountParam = Number(params.get('amount'));

  const campaignQ = usePublic<Campaign>(`/public/campaigns/${campaignSlug}`, Boolean(campaignSlug));
  const eventQ = usePublic<EventItem>(`/public/events/${eventSlug}`, Boolean(eventSlug));
  const campaign = campaignQ.data;
  const campaignUsable = Boolean(campaign && campaign.phase === 'active');
  const causesQ = useCollection<Cause>('causes', { limit: 50 }, !campaignUsable);

  const presets = d.presetAmounts;
  const initialAmount = Number.isFinite(amountParam) && amountParam > 0 ? Math.round(amountParam) : (presets[1] ?? presets[0] ?? 0);
  const [frequency, setFrequency] = useState<'ONE_TIME' | 'MONTHLY'>('ONE_TIME');
  const [amount, setAmount] = useState<number>(initialAmount);
  const [custom, setCustom] = useState<string>(presets.includes(initialAmount) ? '' : String(major(initialAmount)));
  const [amountError, setAmountError] = useState('');
  const [causeSlug, setCauseSlug] = useState(params.get('cause') ?? '');
  const [busy, setBusy] = useState(false);
  const [payError, setPayError] = useState('');
  const [sandbox, setSandbox] = useState<CheckoutResponse | null>(null);
  const [sandboxBusy, setSandboxBusy] = useState<'success' | 'failure' | null>(null);
  const failedRef = useRef<string | null>(null);
  const errorRef = useRef<HTMLDivElement>(null);

  const { register, handleSubmit, formState, setError, setFocus } = useForm<DonorValues>({
    resolver: zodResolver(donorSchema),
    defaultValues: { name: '', email: '', phone: '', pan: '', address: '', isAnonymous: false, message: '', marketingOptIn: false, website: '' },
  });
  const errs = formState.errors;

  useEffect(() => {
    if (payError) errorRef.current?.focus();
  }, [payError]);

  const pickPreset = (a: number) => {
    setAmount(a);
    setCustom('');
    setAmountError('');
  };
  const onCustom = (v: string) => {
    const clean = v.replace(/[^0-9.]/g, '');
    setCustom(clean);
    setAmountError('');
    const n = Number(clean);
    setAmount(Number.isFinite(n) && n > 0 ? Math.round(n * 100) : 0);
  };
  const validateAmount = () => {
    if (!amount) return 'Please choose or enter an amount.';
    if (amount < d.minAmount) return `The minimum donation is ${money(d.minAmount, currency)}.`;
    if (amount > d.maxAmount) return `For gifts above ${money(d.maxAmount, currency)}, please contact us directly.`;
    return '';
  };

  const reportFailure = async (reference: string, reason: string) => {
    if (failedRef.current === reference) return;
    failedRef.current = reference;
    try {
      await send('/donations/failed', { reference, reason: reason.slice(0, 300) });
    } catch {
      /* best effort */
    }
  };

  const verifyAndFinish = async (payload: VerifyPayload) => {
    try {
      await send('/donations/verify', payload);
    } catch (e) {
      // The webhook may still confirm the payment; the thank-you page polls the status.
      if (!(e instanceof ApiError) || e.status >= 500) {
        navigate(`/donate/thank-you/${payload.reference}`);
        return;
      }
      setPayError(`${e.message}. If money was deducted, it will be refunded automatically, or contact us with reference ${payload.reference}.`);
      return;
    }
    navigate(`/donate/thank-you/${payload.reference}`);
  };

  const openRazorpay = async (co: CheckoutResponse) => {
    const Razorpay = await loadRazorpay();
    await new Promise<void>((resolve) => {
      let settled = false;
      const rz = new Razorpay({
        key: co.key,
        amount: co.amount,
        currency: co.currency,
        name: co.name,
        description: campaignUsable && campaign ? campaign.title : frequency === 'MONTHLY' ? 'Monthly donation' : 'Donation',
        ...(co.subscriptionId ? { subscription_id: co.subscriptionId } : { order_id: co.orderId }),
        prefill: co.prefill,
        notes: { reference: co.reference },
        theme: { color: theme.colors.primary },
        handler: (r: RazorpaySuccess) => {
          settled = true;
          setBusy(true);
          void verifyAndFinish({ reference: co.reference, paymentId: r.razorpay_payment_id, signature: r.razorpay_signature, orderId: r.razorpay_order_id, subscriptionId: r.razorpay_subscription_id }).finally(() => {
            setBusy(false);
            resolve();
          });
        },
        modal: {
          ondismiss: () => {
            if (settled) return;
            void reportFailure(co.reference, 'Checkout closed before payment');
            setPayError('The payment window was closed before payment completed. No money was taken — you can try again whenever you’re ready.');
            resolve();
          },
        },
      });
      rz.on('payment.failed', (r) => {
        const reason = r.error?.description || 'Payment failed';
        void reportFailure(co.reference, reason);
        setPayError(`${reason}. No money was taken. Please try again or use a different payment method.`);
      });
      rz.open();
    });
  };

  const onSubmit = handleSubmit(async (values) => {
    const amtErr = validateAmount();
    if (amtErr) {
      setAmountError(amtErr);
      document.getElementById('donation-amount')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    setPayError('');
    setBusy(true);
    failedRef.current = null;
    try {
      const co = await send<CheckoutResponse>('/donations/checkout', {
        ...values,
        amount,
        frequency: d.recurringEnabled ? frequency : 'ONE_TIME',
        campaignSlug: campaignUsable ? campaignSlug : undefined,
        causeSlug: !campaignUsable && causeSlug ? causeSlug : undefined,
        eventSlug: eventSlug || undefined,
        utm: Object.keys(utm).length ? utm : undefined,
      });
      if (co.provider === 'sandbox') {
        setSandbox(co);
        setBusy(false);
        return;
      }
      setBusy(false);
      await openRazorpay(co);
    } catch (e) {
      setBusy(false);
      if (e instanceof ApiError) {
        const fe = e.fieldErrors;
        let focused = false;
        Object.entries(fe).forEach(([k, m]) => {
          if (k === 'amount') return setAmountError(m);
          if (k in donorSchema.shape) {
            setError(k as keyof DonorValues, { message: m });
            if (!focused) {
              setFocus(k as keyof DonorValues);
              focused = true;
            }
          }
        });
        if (!Object.keys(fe).length) setPayError(e.message);
      } else {
        setPayError(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
      }
    }
  });

  const sandboxAct = async (outcome: 'success' | 'failure') => {
    if (!sandbox) return;
    setSandboxBusy(outcome);
    try {
      const r = await send<{ failed?: boolean; paymentId?: string; signature?: string; orderId?: string; subscriptionId?: string }>('/donations/sandbox/authorize', { reference: sandbox.reference, outcome });
      if (r.failed || outcome === 'failure') {
        failedRef.current = sandbox.reference;
        setSandbox(null);
        setPayError('The test payment was declined. No money was taken. You can try again.');
        return;
      }
      setSandbox(null);
      await verifyAndFinish({ reference: sandbox.reference, paymentId: r.paymentId ?? '', signature: r.signature ?? '', orderId: r.orderId, subscriptionId: r.subscriptionId });
    } catch (e) {
      setSandbox(null);
      setPayError(e instanceof ApiError ? e.message : 'The test payment could not be completed. Please try again.');
    } finally {
      setSandboxBusy(null);
    }
  };

  const closeSandbox = () => {
    if (sandboxBusy || !sandbox) return;
    void reportFailure(sandbox.reference, 'Checkout closed before payment');
    setSandbox(null);
    setPayError('The payment window was closed before payment completed. No money was taken.');
  };

  const monthly = d.recurringEnabled && frequency === 'MONTHLY';
  const amountLabel = amount ? `${money(amount, currency)}${monthly ? ' / month' : ''}` : '';
  const causes = causesQ.data?.data ?? [];

  return (
    <section className="container-x section-y" aria-labelledby="checkout-heading" id="donate-form">
      <h2 id="checkout-heading" className="sr-only">Make a donation</h2>
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-14">
        <form onSubmit={onSubmit} noValidate className="relative min-w-0 space-y-6" aria-describedby={payError ? 'pay-error' : undefined}>
          <Honeypot {...register('website')} />

          {/* Step 1 — amount */}
          <Reveal className="card p-6 sm:p-8">
            <StepHeading n={1} title="Your gift" hint={eventQ.data ? <>In support of <Link className="font-medium text-primary underline-offset-4 hover:underline" to={`/events/${eventQ.data.slug}`}>{eventQ.data.title}</Link></> : undefined} />
            {d.recurringEnabled && (
              <div role="radiogroup" aria-label="Donation frequency" className="mb-6 grid grid-cols-2 gap-1 rounded-full bg-surface-alt p-1">
                {(['ONE_TIME', 'MONTHLY'] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    role="radio"
                    aria-checked={frequency === f}
                    onClick={() => setFrequency(f)}
                    className={cn('flex items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold transition', frequency === f ? 'bg-surface text-ink shadow-sm' : 'text-ink-muted hover:text-ink')}
                  >
                    {f === 'MONTHLY' ? <Repeat className="h-4 w-4" aria-hidden /> : <Heart className="h-4 w-4" aria-hidden />}
                    {f === 'MONTHLY' ? 'Monthly' : 'One-time'}
                  </button>
                ))}
              </div>
            )}
            <fieldset id="donation-amount">
              <legend className="field-label">Choose an amount</legend>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {presets.map((a) => (
                  <button
                    key={a}
                    type="button"
                    aria-pressed={!custom && amount === a}
                    onClick={() => pickPreset(a)}
                    className={cn('rounded-2xl border-2 px-3 py-4 text-center font-heading text-xl transition', !custom && amount === a ? 'border-primary bg-primary/5 text-primary' : 'border-line bg-surface text-ink hover:border-primary/50')}
                  >
                    {money(a, currency)}
                  </button>
                ))}
              </div>
              <div className="mt-4">
                <label htmlFor="custom-amount" className="field-label">Or enter your own amount</label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-muted" aria-hidden>{money(0, currency).replace(/[\d.,\s]/g, '')}</span>
                  <Input
                    id="custom-amount"
                    inputMode="decimal"
                    autoComplete="off"
                    placeholder={String(major(d.minAmount))}
                    value={custom}
                    onChange={(e) => onCustom(e.target.value)}
                    className="pl-9 text-lg"
                    invalid={Boolean(amountError)}
                    aria-describedby={amountError ? 'amount-error' : 'amount-help'}
                  />
                </div>
                {amountError ? (
                  <p id="amount-error" className="field-error" role="alert">{amountError}</p>
                ) : (
                  <p id="amount-help" className="field-help">Minimum {money(d.minAmount, currency)}.</p>
                )}
              </div>
            </fieldset>
            {monthly && <p className="mt-4 flex items-center gap-2 rounded-xl bg-primary/5 p-3 text-sm text-ink-muted"><Repeat className="h-4 w-4 shrink-0 text-primary" aria-hidden /> Monthly gifts give us steady support to plan ahead. You can cancel anytime from your donor portal.</p>}

            {!campaignUsable && causes.length > 0 && (
              <div className="mt-6">
                <Field label="Direct your gift (optional)">
                  {(id) => (
                    <Select id={id} value={causeSlug} onChange={(e) => setCauseSlug(e.target.value)}>
                      <option value="">Where it’s needed most</option>
                      {causes.map((c) => <option key={c.id} value={c.slug}>{c.title}</option>)}
                    </Select>
                  )}
                </Field>
              </div>
            )}
          </Reveal>

          {/* Step 2 — donor details */}
          <Reveal className="card p-6 sm:p-8">
            <StepHeading n={2} title="Your details" hint="We’ll send your receipt to this email." />
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Full name" required error={errs.name?.message}>{(id, dsc) => <Input id={id} aria-describedby={dsc} autoComplete="name" invalid={!!errs.name} {...register('name')} />}</Field>
              <Field label="Email" required error={errs.email?.message}>{(id, dsc) => <Input id={id} type="email" aria-describedby={dsc} autoComplete="email" invalid={!!errs.email} {...register('email')} />}</Field>
              {d.collectPhone && (
                <Field label="Phone" error={errs.phone?.message} help="Optional — only used about your donation.">{(id, dsc) => <Input id={id} type="tel" aria-describedby={dsc} autoComplete="tel" invalid={!!errs.phone} {...register('phone')} />}</Field>
              )}
              {d.collectPan && (
                <Field label="PAN" error={errs.pan?.message} help="Needed for a tax receipt.">{(id, dsc) => <Input id={id} aria-describedby={dsc} autoComplete="off" className="uppercase" maxLength={10} invalid={!!errs.pan} {...register('pan')} />}</Field>
              )}
              {d.collectPan && (
                <Field label="Address" error={errs.address?.message} className="sm:col-span-2">{(id, dsc) => <Textarea id={id} aria-describedby={dsc} autoComplete="street-address" rows={2} className="min-h-[80px]" invalid={!!errs.address} {...register('address')} />}</Field>
              )}
              <Field label="Message (optional)" error={errs.message?.message} className="sm:col-span-2">{(id, dsc) => <Textarea id={id} aria-describedby={dsc} rows={3} className="min-h-[90px]" maxLength={500} placeholder="Share why you’re giving, or a dedication" {...register('message')} />}</Field>
            </div>
            <div className="mt-6 space-y-3">
              {d.allowAnonymous && <Checkbox label="Keep my name private — show me as “Anonymous” on public supporter lists" {...register('isAnonymous')} />}
              <Checkbox label="Send me occasional updates about our work. You can unsubscribe anytime." {...register('marketingOptIn')} />
            </div>
          </Reveal>

          {/* Step 3 — pay */}
          <Reveal className="card p-6 sm:p-8">
            <StepHeading n={3} title="Complete your donation" />
            {payError && (
              <div id="pay-error" ref={errorRef} tabIndex={-1} role="alert" className="mb-5 flex gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900 outline-none dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-100">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
                <div>
                  <p className="font-semibold">Payment not completed</p>
                  <p className="mt-0.5">{payError}</p>
                </div>
              </div>
            )}
            <Button type="submit" loading={busy || formState.isSubmitting} icon={Lock} className="w-full py-4 text-base">
              {payError ? 'Try again' : 'Donate'} {amountLabel}
            </Button>
            <p className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-center text-xs text-ink-muted">
              <span className="inline-flex items-center gap-1"><Lock className="h-3 w-3" aria-hidden /> Secure checkout</span>
              <span className="inline-flex items-center gap-1"><Receipt className="h-3 w-3" aria-hidden /> Instant email receipt</span>
              {monthly && <span className="inline-flex items-center gap-1"><CalendarDays className="h-3 w-3" aria-hidden /> Cancel anytime</span>}
            </p>
          </Reveal>
        </form>

        <aside className="space-y-6 lg:sticky lg:top-28 lg:self-start" aria-label="About your donation">
          {campaignSlug && campaignQ.isLoading && <div className="card h-64 animate-pulse" aria-hidden />}
          {campaign && <CampaignContext c={campaign} />}
          <TrustPanel />
          <OfflineOptions />
          <p className="flex items-start gap-2 px-1 text-xs text-ink-muted">
            <Building2 className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            <span>Questions about giving? {settings.contact.email ? <a className="text-primary underline-offset-4 hover:underline" href={`mailto:${settings.contact.email}`}>{settings.contact.email}</a> : <Link to="/contact" className="text-primary underline-offset-4 hover:underline">Contact us</Link>}</span>
          </p>
        </aside>
      </div>

      <Modal
        open={Boolean(sandbox)}
        onClose={closeSandbox}
        title="Test payment"
        size="sm"
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => sandboxAct('failure')} loading={sandboxBusy === 'failure'} disabled={Boolean(sandboxBusy)}>Simulate failed payment</Button>
            <Button size="sm" onClick={() => sandboxAct('success')} loading={sandboxBusy === 'success'} disabled={Boolean(sandboxBusy)}>Simulate successful payment</Button>
          </>
        }
      >
        {sandbox && (
          <div className="space-y-4 text-sm">
            <div className="flex items-start gap-3 rounded-xl bg-amber-50 p-4 text-amber-900 dark:bg-amber-900/30 dark:text-amber-100">
              <FlaskConical className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
              <p><strong>Test mode — no money will be charged.</strong> This site is using a sandbox payment provider so you can try the full donation flow safely.</p>
            </div>
            <dl className="divide-y divide-line rounded-xl border border-line">
              <div className="flex justify-between gap-4 p-3"><dt className="text-ink-muted">Amount</dt><dd className="font-semibold">{money(sandbox.amount, sandbox.currency)}{sandbox.frequency === 'MONTHLY' ? ' / month' : ''}</dd></div>
              <div className="flex justify-between gap-4 p-3"><dt className="text-ink-muted">Reference</dt><dd className="font-mono">{sandbox.reference}</dd></div>
              <div className="flex justify-between gap-4 p-3"><dt className="text-ink-muted">Donor</dt><dd className="truncate">{sandbox.prefill.email}</dd></div>
            </dl>
            <Badge tone="amber">Sandbox</Badge>
          </div>
        )}
      </Modal>
    </section>
  );
}

export default function DonatePage() {
  return (
    <CmsPage slug="donate" fallbackTitle="Make a donation">
      <Checkout />
    </CmsPage>
  );
}
