import { useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { AlertTriangle, CheckCircle2, HandHeart, Heart, Hourglass, Loader2, UserRound } from 'lucide-react';
import { useMotionEnabled, useSite } from '@/app/SiteProvider';
import { get } from '@/lib/api';
import { dateTime, money } from '@/lib/format';
import { ButtonLink, ErrorState, Skeleton, StatusBadge } from '@/components/ui';
import { Seo } from '@/components/site/Seo';
import { ShareButtons } from '@/components/site/ShareButtons';
import { NotFound, isNotFound } from './page-kit';

interface DonationStatus {
  reference: string;
  status: 'PENDING' | 'SUCCESS' | 'FAILED' | 'REFUNDED' | 'PARTIALLY_REFUNDED' | 'CANCELLED';
  amount: number;
  currency: string;
  frequency: 'ONE_TIME' | 'MONTHLY';
  paidAt: string | null;
  campaign: { title: string; slug: string } | null;
  cause: { title: string } | null;
}

const MAX_POLLS = 15; // 4s × 15 ≈ 1 minute

export default function ThankYouPage() {
  const { reference = '' } = useParams();
  const { settings } = useSite();
  const motionOn = useMotionEnabled();
  const startedAt = useRef(Date.now());
  const q = useQuery({
    queryKey: ['donation-status', reference],
    queryFn: () => get<DonationStatus>(`/donations/${encodeURIComponent(reference)}/status`),
    retry: (n, e) => !isNotFound(e) && n < 2,
    refetchInterval: (query) => (query.state.data?.status === 'PENDING' && query.state.dataUpdateCount < MAX_POLLS ? 4000 : false),
  });

  if (isNotFound(q.error)) return <NotFound />;
  const d = q.data;
  const pending = d?.status === 'PENDING';
  const gaveUp = pending && q.dataUpdatedAt - startedAt.current > (MAX_POLLS - 1) * 4000;
  const success = d?.status === 'SUCCESS' || d?.status === 'PARTIALLY_REFUNDED';
  const failed = d?.status === 'FAILED' || d?.status === 'CANCELLED';
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const shareUrl = d?.campaign ? `${origin}/campaigns/${d.campaign.slug}` : `${origin}/donate`;
  const shareTitle = d?.campaign ? `I just supported “${d.campaign.title}” — join me` : `I just donated to ${settings.organization.name} — join me`;

  return (
    <>
      <Seo title="Thank you" noIndex />
      <section className="relative overflow-hidden bg-surface-alt/50">
        <div className="container-x section-y">
          <div className="mx-auto max-w-2xl text-center">
            {q.isLoading ? (
              <div aria-busy="true" aria-label="Loading" className="space-y-4">
                <Skeleton className="mx-auto h-16 w-16 rounded-full" />
                <Skeleton className="mx-auto h-10 w-3/4" />
                <Skeleton className="mx-auto h-5 w-2/3" />
              </div>
            ) : q.error || !d ? (
              <ErrorState message="We couldn’t load your donation status. Your payment is safe — please refresh in a moment." onRetry={() => q.refetch()} />
            ) : (
              <div aria-live="polite">
                <motion.span
                  initial={motionOn ? { scale: 0.6, opacity: 0 } : false}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', damping: 12, stiffness: 160 }}
                  className={`mx-auto grid h-20 w-20 place-items-center rounded-full ${success ? 'bg-primary text-primary-contrast' : failed ? 'bg-red-100 text-red-700' : 'bg-accent/20 text-secondary'}`}
                >
                  {success ? <Heart className="h-9 w-9 fill-current" aria-hidden /> : failed ? <AlertTriangle className="h-9 w-9" aria-hidden /> : <Hourglass className="h-9 w-9" aria-hidden />}
                </motion.span>
                {success && (
                  <>
                    <h1 className="h-section mt-8">{settings.donation.thankYouHeading || 'Thank you for your generosity'}</h1>
                    <p className="lead mt-5 whitespace-pre-line">{settings.donation.thankYouMessage || 'Your donation has been received. A receipt is on its way to your inbox.'}</p>
                  </>
                )}
                {pending && (
                  <>
                    <h1 className="h-section mt-8">We’re confirming your payment</h1>
                    <p className="lead mt-5">
                      {gaveUp
                        ? 'This is taking a little longer than usual. There’s no need to pay again — we’ll email your receipt as soon as the bank confirms.'
                        : 'This usually takes a few seconds. Please keep this page open.'}
                    </p>
                    {!gaveUp && <p className="mt-4 inline-flex items-center gap-2 text-sm text-ink-muted"><Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Checking…</p>}
                  </>
                )}
                {failed && (
                  <>
                    <h1 className="h-section mt-8">Your payment didn’t go through</h1>
                    <p className="lead mt-5">No money was taken. You’re welcome to try again — every gift matters.</p>
                    <ButtonLink href={d.campaign ? `/donate?campaign=${d.campaign.slug}&amount=${d.amount}` : `/donate?amount=${d.amount}`} className="mt-8" icon={Heart}>Try again</ButtonLink>
                  </>
                )}
                {(d.status === 'REFUNDED') && (
                  <>
                    <h1 className="h-section mt-8">This donation was refunded</h1>
                    <p className="lead mt-5">If you have questions, please get in touch with us and quote the reference below.</p>
                  </>
                )}

                <dl className="card mx-auto mt-10 max-w-md divide-y divide-line text-left text-sm">
                  <div className="flex items-center justify-between gap-4 p-4"><dt className="text-ink-muted">Amount</dt><dd className="font-heading text-xl">{money(d.amount, d.currency)}{d.frequency === 'MONTHLY' ? <span className="text-sm text-ink-muted"> / month</span> : null}</dd></div>
                  <div className="flex items-center justify-between gap-4 p-4"><dt className="text-ink-muted">Reference</dt><dd className="font-mono">{d.reference}</dd></div>
                  <div className="flex items-center justify-between gap-4 p-4"><dt className="text-ink-muted">Status</dt><dd><StatusBadge status={d.status} /></dd></div>
                  {(d.campaign || d.cause) && <div className="flex items-center justify-between gap-4 p-4"><dt className="text-ink-muted">Supporting</dt><dd className="text-right font-medium">{d.campaign?.title ?? d.cause?.title}</dd></div>}
                  {d.paidAt && <div className="flex items-center justify-between gap-4 p-4"><dt className="text-ink-muted">Date</dt><dd>{dateTime(d.paidAt)}</dd></div>}
                </dl>
                {success && <p className="mt-4 inline-flex items-center gap-1.5 text-sm text-ink-muted"><CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden /> A receipt has been emailed to you.</p>}
              </div>
            )}
          </div>
        </div>
      </section>

      {d && !failed && (
        <section className="container-x section-y">
          <div className="mx-auto grid max-w-5xl gap-6 md:grid-cols-3">
            <div className="card flex flex-col p-7">
              <Heart className="h-6 w-6 text-primary" aria-hidden />
              <h2 className="mt-4 font-heading text-xl">Multiply your impact</h2>
              <p className="mt-2 flex-1 text-sm text-ink-muted">Share with friends and family — one share can inspire another gift.</p>
              <div className="mt-5"><ShareButtons title={shareTitle} url={shareUrl} /></div>
            </div>
            <div className="card flex flex-col p-7">
              <UserRound className="h-6 w-6 text-primary" aria-hidden />
              <h2 className="mt-4 font-heading text-xl">Your donor portal</h2>
              <p className="mt-2 flex-1 text-sm text-ink-muted">Download receipts, see your giving history and manage monthly gifts.</p>
              <ButtonLink href="/donor" variant="outline" size="sm" className="mt-5 self-start">Open donor portal</ButtonLink>
            </div>
            <div className="card flex flex-col p-7">
              <HandHeart className="h-6 w-6 text-primary" aria-hidden />
              <h2 className="mt-4 font-heading text-xl">Give your time</h2>
              <p className="mt-2 flex-1 text-sm text-ink-muted">Volunteers are the heart of our work. Find a role that fits your skills.</p>
              <ButtonLink href="/volunteer" variant="outline" size="sm" className="mt-5 self-start">Volunteer with us</ButtonLink>
            </div>
          </div>
        </section>
      )}
    </>
  );
}
