import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CalendarClock, CheckCircle2, Circle, Heart, Lock, MapPin, Receipt, Users } from 'lucide-react';
import { useSite } from '@/app/SiteProvider';
import { cn } from '@/lib/cn';
import { date, money, plural, relative } from '@/lib/format';
import { usePublic } from '@/lib/queries';
import type { Campaign } from '@/lib/types';
import { Badge, ButtonLink } from '@/components/ui';
import { Gallery } from '@/components/site/Lightbox';
import { Markdown } from '@/components/site/Markdown';
import { ProgressBar, Reveal } from '@/components/site/motion';
import { Seo } from '@/components/site/Seo';
import { ShareButtons } from '@/components/site/ShareButtons';
import { SmartImage } from '@/components/site/SmartImage';
import { Block, DetailBanner, QueryGate, pageUrl, toGallery } from './page-kit';

interface CampaignUpdate { id: string; title: string; body: string; image: string; publishedAt: string }
interface RelatedProject { slug: string; title: string; summary: string; coverImage: string; coverAlt: string; location: string }
interface Supporter { name: string; amount: number; currency: string; at: string | null }
type CampaignDetail = Campaign & { updates: CampaignUpdate[]; projects: RelatedProject[]; recentSupporters: Supporter[] };

export default function CampaignDetailPage() {
  const { slug = '' } = useParams();
  const query = usePublic<CampaignDetail>(`/public/campaigns/${slug}`);
  return <QueryGate query={query}>{(c) => <CampaignView c={c} />}</QueryGate>;
}

function daysLeft(end: string | null): number | null {
  if (!end) return null;
  return Math.max(0, Math.ceil((new Date(end).getTime() - Date.now()) / 86_400_000));
}

function DonatePanel({ c }: { c: CampaignDetail }) {
  const { settings } = useSite();
  const amounts = useMemo(() => {
    const fromCampaign = (c.suggestedAmounts ?? []).map((s) => Math.round(Number(String(s).replace(/[^0-9.]/g, '')) * 100)).filter((n) => Number.isFinite(n) && n > 0);
    return (fromCampaign.length ? fromCampaign : settings.donation.presetAmounts).slice(0, 6);
  }, [c.suggestedAmounts, settings.donation.presetAmounts]);
  const [amount, setAmount] = useState<number>(amounts[1] ?? amounts[0] ?? 0);
  const left = daysLeft(c.endDate);
  const active = c.phase === 'active';
  const donateHref = `/donate?campaign=${encodeURIComponent(c.slug)}${amount ? `&amount=${amount}` : ''}`;

  return (
    <div className="card p-6 sm:p-7">
      <div className="flex items-baseline justify-between gap-3">
        <p>
          <span className="font-heading text-[2rem] leading-none text-ink">{money(c.raised, c.currency)}</span>
          <span className="mt-1 block text-sm text-ink-muted">raised of {money(c.goalAmount, c.currency)} goal</span>
        </p>
        <span className="font-heading text-2xl text-primary">{c.percent}%</span>
      </div>
      <ProgressBar percent={c.percent} className="mt-5 h-2.5" label={`${c.percent}% of goal raised`} />
      <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-xl bg-surface-alt/60 p-3">
          <dt className="flex items-center gap-1.5 text-ink-muted"><Users className="h-4 w-4" aria-hidden /> Supporters</dt>
          <dd className="mt-1 font-semibold text-ink">{c.donors.toLocaleString('en-IN')}</dd>
        </div>
        <div className="rounded-xl bg-surface-alt/60 p-3">
          <dt className="flex items-center gap-1.5 text-ink-muted"><CalendarClock className="h-4 w-4" aria-hidden /> {c.phase === 'upcoming' ? 'Starts' : 'Time left'}</dt>
          <dd className="mt-1 font-semibold text-ink">
            {c.phase === 'upcoming' ? date(c.startDate) : c.phase === 'completed' ? 'Ended' : left === null ? 'Ongoing' : left === 0 ? 'Last day' : plural(left, 'day')}
          </dd>
        </div>
      </dl>

      {active ? (
        <>
          <fieldset className="mt-6">
            <legend className="mb-3 text-sm font-semibold text-ink">Choose an amount</legend>
            <div className="grid grid-cols-2 gap-2">
              {amounts.map((a) => (
                <button
                  key={a}
                  type="button"
                  aria-pressed={amount === a}
                  onClick={() => setAmount(a)}
                  className={cn('rounded-xl border px-3 py-3 text-sm font-semibold transition', amount === a ? 'border-primary bg-primary text-primary-contrast' : 'border-line bg-surface text-ink hover:border-primary/60')}
                >
                  {money(a, c.currency)}
                </button>
              ))}
            </div>
          </fieldset>
          <ButtonLink href={donateHref} icon={Heart} className="mt-5 w-full">Donate {amount ? money(amount, c.currency) : 'now'}</ButtonLink>
          <ButtonLink href={`/donate?campaign=${encodeURIComponent(c.slug)}`} variant="ghost" size="sm" className="mt-2 w-full justify-center text-primary">Enter a different amount</ButtonLink>
          <ul className="mt-5 space-y-2 border-t border-line pt-5 text-xs text-ink-muted">
            <li className="flex items-center gap-2"><Lock className="h-3.5 w-3.5 text-primary" aria-hidden /> Secure, encrypted payment</li>
            <li className="flex items-center gap-2"><Receipt className="h-3.5 w-3.5 text-primary" aria-hidden /> Instant receipt by email</li>
          </ul>
        </>
      ) : (
        <div className="mt-6 rounded-xl border border-line bg-surface-alt/50 p-4 text-sm text-ink-muted" role="note">
          {c.phase === 'upcoming'
            ? `This campaign opens for donations on ${date(c.startDate, 'long')}. Until then, you can support our work with a general donation.`
            : 'This campaign has closed and is no longer accepting donations. Thank you to everyone who gave. You can still support our ongoing work.'}
          <ButtonLink href={c.cause ? `/donate?cause=${encodeURIComponent(c.cause.slug)}` : '/donate'} variant="outline" size="sm" className="mt-4 w-full">Make a general donation</ButtonLink>
        </div>
      )}
    </div>
  );
}

function Milestones({ c }: { c: CampaignDetail }) {
  if (!c.milestones?.length) return null;
  return (
    <Block title="Milestones" eyebrow="The journey" id="campaign-milestones">
      <ol className="relative space-y-8 border-l-2 border-line pl-8">
        {c.milestones.map((m, i) => (
          <Reveal as="li" key={i} delay={i * 0.06} className="relative">
            <span className={cn('absolute -left-[2.6rem] top-0 grid h-8 w-8 place-items-center rounded-full ring-4 ring-bg', m.achieved ? 'bg-primary text-primary-contrast' : 'bg-surface text-ink-muted border border-line')}>
              {m.achieved ? <CheckCircle2 className="h-4 w-4" aria-hidden /> : <Circle className="h-3 w-3" aria-hidden />}
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-heading text-xl">{m.title}</h3>
              {m.achieved ? <Badge tone="green">Achieved</Badge> : <Badge>Next</Badge>}
            </div>
            <p className="mt-1 text-sm text-ink-muted">
              {[m.date && date(m.date), m.targetAmount ? `at ${money(m.targetAmount, c.currency)}` : ''].filter(Boolean).join(' · ')}
            </p>
            {m.description && <p className="mt-2 text-ink-muted">{m.description}</p>}
            <span className="sr-only">{m.achieved ? 'Milestone achieved' : 'Milestone not yet achieved'}</span>
          </Reveal>
        ))}
      </ol>
    </Block>
  );
}

function CampaignView({ c }: { c: CampaignDetail }) {
  const { settings } = useSite();
  const gallery = toGallery(c.gallery, c.title);
  const description = c.seoDescription || c.summary;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: c.title,
    description,
    url: pageUrl(),
    image: c.coverImage || undefined,
    about: { '@type': 'NGO', name: settings.organization.name },
    potentialAction: { '@type': 'DonateAction', name: `Donate to ${c.title}`, target: `${typeof window !== 'undefined' ? window.location.origin : ''}/donate?campaign=${c.slug}`, recipient: { '@type': 'NGO', name: settings.organization.name } },
  };
  const phaseBadge = c.phase === 'upcoming' ? 'Upcoming campaign' : c.phase === 'completed' ? 'Completed campaign' : 'Active campaign';

  return (
    <>
      <Seo title={c.seoTitle || c.title} description={description} image={c.coverImage} jsonLd={jsonLd} />
      <DetailBanner
        image={c.coverImage}
        alt={c.coverAlt}
        eyebrow={c.cause ? <Link to={`/causes/${c.cause.slug}`} className="hover:underline">{c.cause.title}</Link> : phaseBadge}
        title={c.title}
        subtitle={c.summary}
        isSample={c.isSample}
        back={{ href: '/campaigns', label: 'All campaigns' }}
      >
        <div className="max-w-xl">
          <ProgressBar percent={c.percent} tone="white" className="h-1.5 bg-white/20" label={`${c.percent}% of goal raised`} />
          <p className="mt-3 text-sm text-white/80">
            <strong className="text-white">{money(c.raised, c.currency)}</strong> raised of {money(c.goalAmount, c.currency)} · {plural(c.donors, 'supporter')}
          </p>
        </div>
      </DetailBanner>

      <div className="container-x section-y">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-16">
          <div className="order-2 min-w-0 lg:order-1">
            {c.body && (
              <Block title="The story" eyebrow="Why this matters" id="campaign-story">
                <Markdown>{c.body}</Markdown>
              </Block>
            )}

            <div className="mt-16"><Milestones c={c} /></div>

            {c.updates.length > 0 && (
              <Block title="Updates" eyebrow="Latest news" id="campaign-updates" className="mt-16">
                <ul className="space-y-6">
                  {c.updates.map((u) => (
                    <Reveal as="li" key={u.id} className="card overflow-hidden sm:flex">
                      {u.image && (
                        <div className="aspect-[16/10] sm:aspect-auto sm:w-56 sm:shrink-0">
                          <SmartImage src={u.image} alt={u.title} sizes="(min-width:640px) 224px, 100vw" width={600} />
                        </div>
                      )}
                      <div className="p-6">
                        <p className="text-xs font-semibold uppercase tracking-wider text-accent">{date(u.publishedAt, 'long')}</p>
                        <h3 className="mt-2 font-heading text-xl">{u.title}</h3>
                        <Markdown className="prose-base mt-2 text-ink-muted">{u.body}</Markdown>
                      </div>
                    </Reveal>
                  ))}
                </ul>
              </Block>
            )}

            {gallery.length > 0 && (
              <Block title="Gallery" eyebrow="In pictures" id="campaign-gallery" className="mt-16">
                <Gallery images={gallery} columns={2} />
              </Block>
            )}

            {c.projects.length > 0 && (
              <Block title="Projects this campaign funds" eyebrow="Where your money goes" id="campaign-projects" className="mt-16">
                <div className="grid gap-5 sm:grid-cols-2">
                  {c.projects.map((p) => (
                    <Link key={p.slug} to={`/projects/${p.slug}`} className="card card-hover group flex flex-col">
                      <div className="aspect-[16/10] overflow-hidden">
                        <SmartImage src={p.coverImage} alt={p.coverAlt || p.title} sizes="(min-width:640px) 30vw, 100vw" width={700} className="transition-transform duration-700 group-hover:scale-105" />
                      </div>
                      <div className="p-5">
                        {p.location && <p className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-accent"><MapPin className="h-3.5 w-3.5" aria-hidden />{p.location}</p>}
                        <h3 className="mt-1 font-heading text-xl">{p.title}</h3>
                        <p className="mt-1 line-clamp-2 text-sm text-ink-muted">{p.summary}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              </Block>
            )}

            <div className="mt-16 border-t border-line pt-8"><ShareButtons title={c.title} /></div>
          </div>

          <aside className="order-1 lg:order-2 lg:sticky lg:top-28 lg:self-start" aria-label="Donate to this campaign">
            <DonatePanel c={c} />
            {c.recentSupporters.length > 0 && (
              <div className="card mt-6 p-6">
                <h2 className="font-heading text-lg">Recent supporters</h2>
                <ul className="mt-4 divide-y divide-line">
                  {c.recentSupporters.map((s, i) => (
                    <li key={i} className="flex items-center gap-3 py-3 text-sm">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/10 font-semibold text-primary" aria-hidden>{s.name.charAt(0).toUpperCase()}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium text-ink">{s.name}</span>
                        {s.at && <span className="text-xs text-ink-muted">{relative(s.at)}</span>}
                      </span>
                      <span className="font-semibold text-ink">{money(s.amount, s.currency)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </aside>
        </div>
      </div>
    </>
  );
}
