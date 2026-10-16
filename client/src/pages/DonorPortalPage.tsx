import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Download, FileDown, Heart, LogOut, Mail, MailCheck, Repeat, UserRound } from 'lucide-react';
import { useSite } from '@/app/SiteProvider';
import { ApiError, get, send } from '@/lib/api';
import { date, money, plural } from '@/lib/format';
import { Button, ButtonLink, EmptyState, ErrorState, Field, Input, Skeleton, StatusBadge, useConfirm, useToast } from '@/components/ui';
import { Seo } from '@/components/site/Seo';
import { Reveal } from '@/components/site/motion';

interface DonorDonation {
  id: string;
  reference: string;
  amount: number;
  refundedAmount: number;
  currency: string;
  status: string;
  frequency: 'ONE_TIME' | 'MONTHLY';
  paidAt: string | null;
  createdAt: string;
  campaign: { title: string; slug: string } | null;
  cause: { title: string } | null;
  receipts: { id: string; receiptNumber: string }[];
}
interface DonorRecurring { id: string; reference: string; amount: number; currency: string; status: string; createdAt: string; campaign: { title: string } | null }
interface DonorMe { name: string; email: string; phone: string; marketingOptIn: boolean; donations: DonorDonation[]; recurring: DonorRecurring[] }

const ME_KEY = ['donor-me'];

function LoginForm({ notice }: { notice?: string }) {
  const schema = z.object({ email: z.string().trim().email('Enter the email you used to donate') });
  const { register, handleSubmit, formState, setError } = useForm<{ email: string }>({ resolver: zodResolver(schema), defaultValues: { email: '' } });
  const [sentTo, setSentTo] = useState('');
  const onSubmit = handleSubmit(async ({ email }) => {
    try {
      await send('/donor/login', { email });
      setSentTo(email);
    } catch (e) {
      setError('email', { message: e instanceof ApiError ? e.message : 'Something went wrong. Please try again.' });
    }
  });
  return (
    <section className="container-x section-y">
      <Reveal className="card mx-auto max-w-lg p-8 sm:p-12">
        {sentTo ? (
          <div className="text-center" role="status">
            <MailCheck className="mx-auto h-12 w-12 text-primary" aria-hidden />
            <h1 className="mt-5 font-heading text-3xl">Check your inbox</h1>
            <p className="mt-3 text-ink-muted">If <strong className="text-ink">{sentTo}</strong> matches a donor record, we’ve sent a secure sign-in link. It expires in 30 minutes.</p>
            <button type="button" className="btn btn-ghost mt-6 text-primary" onClick={() => setSentTo('')}>Use a different email</button>
          </div>
        ) : (
          <>
            <span className="grid h-14 w-14 place-items-center rounded-full bg-primary/10 text-primary"><UserRound className="h-6 w-6" aria-hidden /></span>
            <h1 className="mt-5 font-heading text-3xl">Donor portal</h1>
            <p className="mt-2 text-ink-muted">See your giving history, download receipts and manage monthly gifts. No password needed — we’ll email you a sign-in link.</p>
            {notice && <p role="alert" className="mt-5 rounded-xl bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-900/30 dark:text-amber-100">{notice}</p>}
            <form onSubmit={onSubmit} noValidate className="mt-6 space-y-4">
              <Field label="Email address" error={formState.errors.email?.message}>{(id, d) => <Input id={id} type="email" autoComplete="email" aria-describedby={d} invalid={!!formState.errors.email} {...register('email')} />}</Field>
              <Button type="submit" loading={formState.isSubmitting} icon={Mail} className="w-full">Email me a sign-in link</Button>
            </form>
          </>
        )}
      </Reveal>
    </section>
  );
}

function Dashboard({ me }: { me: DonorMe }) {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const toast = useToast();
  const { settings } = useSite();

  const totals = useMemo(() => {
    const counted = me.donations.filter((d) => d.status === 'SUCCESS' || d.status === 'PARTIALLY_REFUNDED');
    const byCurrency = new Map<string, number>();
    counted.forEach((d) => byCurrency.set(d.currency, (byCurrency.get(d.currency) ?? 0) + d.amount - (d.refundedAmount ?? 0)));
    return { gifts: counted.length, byCurrency: [...byCurrency.entries()] };
  }, [me.donations]);
  const activeMonthly = me.recurring.filter((r) => r.status === 'ACTIVE' || r.status === 'CREATED');

  const prefs = useMutation({
    mutationFn: (marketingOptIn: boolean) => send('/donor/preferences', { marketingOptIn }, 'PUT'),
    onSuccess: (_d, v) => {
      qc.setQueryData<DonorMe>(ME_KEY, (old) => (old ? { ...old, marketingOptIn: v } : old));
      toast(v ? 'You’ll receive our updates.' : 'You won’t receive marketing emails.');
    },
    onError: () => toast('Couldn’t update your preference. Please try again.', 'error'),
  });
  const cancelMonthly = useMutation({
    mutationFn: (id: string) => send(`/donor/recurring/${id}/cancel`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ME_KEY });
      toast('Your monthly gift has been cancelled.');
    },
    onError: (e) => toast(e instanceof ApiError ? e.message : 'Couldn’t cancel. Please try again.', 'error'),
  });
  const logout = useMutation({
    mutationFn: () => send('/donor/logout'),
    onSettled: () => qc.setQueryData(ME_KEY, null),
  });

  const onCancel = async (r: DonorRecurring) => {
    const ok = await confirm({
      title: 'Cancel monthly gift?',
      message: `Your ${money(r.amount, r.currency)} monthly gift${r.campaign ? ` to ${r.campaign.title}` : ''} will stop. No further payments will be taken.`,
      confirmLabel: 'Cancel monthly gift',
      danger: true,
    });
    if (ok) cancelMonthly.mutate(r.id);
  };

  return (
    <section className="container-x section-y">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">Donor portal</p>
          <h1 className="h-section mt-3">Hello, {me.name.split(' ')[0]}</h1>
          <p className="mt-2 text-ink-muted">{me.email}</p>
        </div>
        <Button variant="outline" size="sm" icon={LogOut} onClick={() => logout.mutate()} loading={logout.isPending}>Sign out</Button>
      </div>

      <div className="mt-10 grid gap-5 sm:grid-cols-3">
        <Reveal className="card p-6 sm:col-span-2 bg-primary text-primary-contrast on-dark">
          <p className="text-sm text-white/75">Total given</p>
          <p className="mt-2 font-heading text-[2.4rem] leading-none">
            {totals.byCurrency.length ? totals.byCurrency.map(([c, v]) => money(v, c)).join(' + ') : money(0, settings.donation.currency)}
          </p>
          <p className="mt-3 text-sm text-white/75">Thank you — every gift helps us do more.</p>
        </Reveal>
        <Reveal delay={0.08} className="card p-6">
          <p className="text-sm text-ink-muted">Gifts</p>
          <p className="mt-2 font-heading text-[2.4rem] leading-none">{totals.gifts}</p>
          <p className="mt-3 text-sm text-ink-muted">{activeMonthly.length ? plural(activeMonthly.length, 'active monthly gift') : 'No active monthly gifts'}</p>
        </Reveal>
      </div>

      {me.recurring.length > 0 && (
        <div className="mt-14">
          <h2 className="font-heading text-2xl">Monthly gifts</h2>
          <ul className="mt-5 grid gap-4 md:grid-cols-2">
            {me.recurring.map((r) => (
              <li key={r.id} className="card flex flex-wrap items-center gap-4 p-5">
                <span className="grid h-11 w-11 place-items-center rounded-full bg-primary/10 text-primary"><Repeat className="h-5 w-5" aria-hidden /></span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{money(r.amount, r.currency)} / month</p>
                  <p className="truncate text-sm text-ink-muted">{r.campaign?.title ?? 'General fund'} · since {date(r.createdAt)}</p>
                </div>
                <StatusBadge status={r.status} />
                {(r.status === 'ACTIVE' || r.status === 'CREATED') && (
                  <Button variant="ghost" size="sm" className="text-red-700" onClick={() => onCancel(r)} loading={cancelMonthly.isPending && cancelMonthly.variables === r.id}>Cancel</Button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-14">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="font-heading text-2xl">Donation history</h2>
          <ButtonLink href="/donate" size="sm" icon={Heart}>Give again</ButtonLink>
        </div>
        {me.donations.length === 0 ? (
          <div className="mt-5"><EmptyState icon={Heart} title="No donations yet">When you donate, your history and receipts will appear here.</EmptyState></div>
        ) : (
          <div className="mt-5 overflow-x-auto rounded-theme-img border border-line bg-surface">
            <table className="table-base min-w-[640px]">
              <caption className="sr-only">Your donations</caption>
              <thead>
                <tr><th scope="col">Date</th><th scope="col">Supporting</th><th scope="col">Amount</th><th scope="col">Status</th><th scope="col">Receipt</th></tr>
              </thead>
              <tbody>
                {me.donations.map((d) => (
                  <tr key={d.id}>
                    <td className="whitespace-nowrap">{date(d.paidAt ?? d.createdAt)}<span className="block font-mono text-xs text-ink-muted">{d.reference}</span></td>
                    <td>{d.campaign ? <Link to={`/campaigns/${d.campaign.slug}`} className="hover:text-primary hover:underline">{d.campaign.title}</Link> : d.cause?.title ?? 'General fund'}{d.frequency === 'MONTHLY' && <span className="ml-2 text-xs text-ink-muted">(monthly)</span>}</td>
                    <td className="whitespace-nowrap font-semibold">{money(d.amount, d.currency)}{d.refundedAmount > 0 && <span className="block text-xs font-normal text-ink-muted">{money(d.refundedAmount, d.currency)} refunded</span>}</td>
                    <td><StatusBadge status={d.status} /></td>
                    <td>
                      {d.receipts.length ? (
                        <div className="flex flex-col gap-1">
                          {d.receipts.map((r) => (
                            <a key={r.id} href={`/api/v1/donor/receipts/${r.id}/pdf`} className="inline-flex items-center gap-1.5 whitespace-nowrap text-sm font-medium text-primary hover:underline" download>
                              <FileDown className="h-4 w-4" aria-hidden /> <span className="sr-only">Download receipt </span>{r.receiptNumber}
                            </a>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-ink-muted">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="mt-14 grid gap-5 md:grid-cols-2">
        <div className="card p-6">
          <h2 className="font-heading text-xl">Email preferences</h2>
          <label className="mt-4 flex cursor-pointer items-start justify-between gap-4">
            <span className="text-sm text-ink-muted">Send me news and updates about our work. Receipts and essential messages are always sent.</span>
            <input
              type="checkbox"
              role="switch"
              aria-checked={me.marketingOptIn}
              checked={me.marketingOptIn}
              disabled={prefs.isPending}
              onChange={(e) => prefs.mutate(e.target.checked)}
              className="peer sr-only"
            />
            <span aria-hidden className={`relative mt-0.5 h-7 w-12 shrink-0 rounded-full transition peer-focus-visible:ring-4 peer-focus-visible:ring-primary/30 ${me.marketingOptIn ? 'bg-primary' : 'bg-ink/20'}`}>
              <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${me.marketingOptIn ? 'left-6' : 'left-1'}`} />
            </span>
          </label>
        </div>
        <div className="card p-6">
          <h2 className="font-heading text-xl">Your data</h2>
          <p className="mt-2 text-sm text-ink-muted">Download a copy of everything we hold about you as a JSON file.</p>
          <a href="/api/v1/donor/export" className="btn btn-outline btn-sm mt-4" download>
            <Download className="h-4 w-4" aria-hidden /> Download my data
          </a>
        </div>
      </div>
    </section>
  );
}

export default function DonorPortalPage() {
  const [params, setParams] = useSearchParams();
  const qc = useQueryClient();
  const token = params.get('token');
  const [sessionError, setSessionError] = useState('');
  const [exchanging, setExchanging] = useState(Boolean(token));
  const started = useRef(false);

  // Exchange a magic-link token for a session cookie, then remove it from the URL.
  useEffect(() => {
    if (!token || started.current) return;
    started.current = true;
    (async () => {
      try {
        await send('/donor/session', { token });
      } catch (e) {
        setSessionError(e instanceof ApiError ? e.message : 'This sign-in link could not be used. Please request a new one.');
      } finally {
        const next = new URLSearchParams(params);
        next.delete('token');
        setParams(next, { replace: true });
        await qc.invalidateQueries({ queryKey: ME_KEY });
        setExchanging(false);
      }
    })();
  }, [token, params, setParams, qc]);

  const me = useQuery({
    queryKey: ME_KEY,
    queryFn: async () => {
      try {
        return await get<DonorMe>('/donor/me');
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) return null;
        throw e;
      }
    },
    enabled: !exchanging,
    retry: 1,
    staleTime: 30_000,
  });

  return (
    <>
      <Seo title="Donor portal" noIndex />
      {exchanging || me.isLoading ? (
        <section className="container-x section-y" aria-busy="true" aria-label="Loading">
          <Skeleton className="h-10 w-64" />
          <div className="mt-10 grid gap-5 sm:grid-cols-3"><Skeleton className="h-36 sm:col-span-2" /><Skeleton className="h-36" /></div>
          <Skeleton className="mt-12 h-64 w-full" />
        </section>
      ) : me.error ? (
        <div className="container-x section-y"><ErrorState message="We couldn’t load your donor account." onRetry={() => me.refetch()} /></div>
      ) : me.data ? (
        <Dashboard me={me.data} />
      ) : (
        <LoginForm notice={sessionError} />
      )}
    </>
  );
}
