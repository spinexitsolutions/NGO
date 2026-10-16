import type { ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowRight, CalendarRange, Download, Flag, HandCoins, MapPin, Megaphone, Users, Wallet } from 'lucide-react';
import { date, money } from '@/lib/format';
import { usePublic } from '@/lib/queries';
import type { Opportunity, Project, Story } from '@/lib/types';
import { Badge, ButtonLink } from '@/components/ui';
import { StoryCard } from '@/components/site/cards';
import { Gallery } from '@/components/site/Lightbox';
import { Markdown } from '@/components/site/Markdown';
import { ProgressBar, Reveal } from '@/components/site/motion';
import { Seo } from '@/components/site/Seo';
import { ShareButtons } from '@/components/site/ShareButtons';
import { SmartImage } from '@/components/site/SmartImage';
import { OpportunityCard } from '@/features/sections/DataSections';
import { Block, DetailBanner, QueryGate, TickList, toGallery } from './page-kit';

interface Report { id: string; title: string; kind: 'UPDATE' | 'REPORT'; body: string; image: string; fileUrl: string; publishedAt: string }
type ProjectDetail = Project & { reports: Report[]; stories: Story[]; opportunities: Opportunity[] };

export default function ProjectDetailPage() {
  const { slug = '' } = useParams();
  const query = usePublic<ProjectDetail>(`/public/projects/${slug}`);
  return <QueryGate query={query}>{(p) => <ProjectView p={p} />}</QueryGate>;
}

/** Converts a YouTube/Vimeo URL to a privacy-friendly embed URL; null for anything else. */
function embedUrl(url: string): string | null {
  if (!url) return null;
  const yt = url.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  if (yt) return `https://www.youtube-nocookie.com/embed/${yt[1]}?rel=0`;
  const vimeo = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}?dnt=1`;
  return null;
}

const PHASE_LABEL: Record<Project['phase'], string> = { PLANNED: 'Planned', ONGOING: 'Ongoing', COMPLETED: 'Completed' };

function Fact({ icon: I, label, children }: { icon: typeof MapPin; label: string; children: ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary"><I className="h-4 w-4" aria-hidden /></span>
      <div className="min-w-0">
        <dt className="text-xs font-semibold uppercase tracking-wider text-ink-muted">{label}</dt>
        <dd className="mt-0.5 font-medium text-ink">{children}</dd>
      </div>
    </div>
  );
}

function ProjectView({ p }: { p: ProjectDetail }) {
  const gallery = toGallery(p.gallery, p.title);
  const video = embedUrl(p.videoUrl);
  const duration = `${date(p.startDate)}${p.endDate ? ` – ${date(p.endDate)}` : p.phase === 'COMPLETED' ? '' : ' – present'}`;
  const hasBudget = p.budgetAmount != null && p.budgetAmount > 0;
  const hasFunding = p.fundingSecured != null && p.fundingSecured > 0;
  const fundedPct = hasBudget && hasFunding ? Math.round(((p.fundingSecured ?? 0) / (p.budgetAmount ?? 1)) * 100) : null;

  return (
    <>
      <Seo title={p.seoTitle || p.title} description={p.seoDescription || p.summary} image={p.coverImage} />
      <DetailBanner image={p.coverImage} alt={p.coverAlt} eyebrow={p.cause ? <Link to={`/causes/${p.cause.slug}`} className="hover:underline">{p.cause.title}</Link> : 'Project'} title={p.title} subtitle={p.summary} isSample={p.isSample} back={{ href: '/projects', label: 'All projects' }} />

      <div className="container-x section-y">
        <Reveal className="card -mt-28 relative p-6 sm:-mt-32 sm:p-8">
          <dl className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {p.location && <Fact icon={MapPin} label="Location">{p.location}</Fact>}
            <Fact icon={CalendarRange} label="Duration">{duration}</Fact>
            <Fact icon={Flag} label="Phase"><Badge tone={p.phase === 'COMPLETED' ? 'blue' : p.phase === 'ONGOING' ? 'green' : 'amber'}>{PHASE_LABEL[p.phase]}</Badge></Fact>
            {p.beneficiariesReached != null && <Fact icon={Users} label="People reached">{p.beneficiariesReached.toLocaleString('en-IN')}</Fact>}
            {hasBudget && <Fact icon={Wallet} label="Budget">{money(p.budgetAmount)}</Fact>}
            {hasFunding && <Fact icon={HandCoins} label="Funding secured">{money(p.fundingSecured)}</Fact>}
          </dl>
          {fundedPct !== null && (
            <div className="mt-6 border-t border-line pt-6">
              <ProgressBar percent={fundedPct} label={`${fundedPct}% of budget funded`} />
              <p className="mt-2 text-sm text-ink-muted">{Math.min(100, fundedPct)}% of the budget is funded</p>
            </div>
          )}
        </Reveal>

        <div className="mt-16 grid gap-12 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-16">
          <div className="min-w-0">
            {p.body && <Reveal><Markdown>{p.body}</Markdown></Reveal>}
            {video && (
              <Reveal className="mt-12 overflow-hidden rounded-theme-img bg-black">
                <div className="aspect-video">
                  <iframe src={video} title={`Video: ${p.title}`} className="h-full w-full" loading="lazy" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />
                </div>
              </Reveal>
            )}
          </div>
          <aside className="space-y-5 lg:sticky lg:top-28 lg:self-start" aria-label="Project summary">
            <TickList title="Objectives" items={p.objectives} />
            {p.campaign && (
              <Link to={`/campaigns/${p.campaign.slug}`} className="card card-hover group flex items-center gap-4 p-5">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-accent/20 text-secondary"><Megaphone className="h-5 w-5" aria-hidden /></span>
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-semibold uppercase tracking-wider text-ink-muted">Funded by campaign</span>
                  <span className="block font-heading text-lg leading-snug">{p.campaign.title}</span>
                </span>
                <ArrowRight className="h-4 w-4 text-primary transition-transform group-hover:translate-x-1" aria-hidden />
              </Link>
            )}
            <div className="card p-5">
              <p className="font-heading text-lg">Help this project grow</p>
              <ButtonLink href={p.campaign ? `/donate?campaign=${p.campaign.slug}` : p.cause ? `/donate?cause=${p.cause.slug}` : '/donate'} className="mt-4 w-full">Donate</ButtonLink>
            </div>
          </aside>
        </div>

        {(p.activities.length > 0 || p.outcomes.length > 0) && (
          <div className="mt-16 grid gap-5 md:grid-cols-2">
            <TickList title="Activities" items={p.activities} />
            <TickList title="Outcomes" items={p.outcomes} />
          </div>
        )}

        {gallery.length > 0 && (
          <Block title="From the field" eyebrow="Gallery" id="project-gallery" className="mt-20">
            <Gallery images={gallery} />
          </Block>
        )}

        {p.reports.length > 0 && (
          <Block title="Progress updates & reports" eyebrow="Transparency" id="project-reports" className="mt-20">
            <ol className="space-y-5">
              {p.reports.map((r) => (
                <Reveal as="li" key={r.id} className="card flex flex-col gap-5 p-6 sm:flex-row">
                  {r.image && (
                    <div className="aspect-[16/10] overflow-hidden rounded-xl sm:w-48 sm:shrink-0">
                      <SmartImage src={r.image} alt={r.title} sizes="200px" width={500} />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={r.kind === 'REPORT' ? 'brand' : 'neutral'}>{r.kind === 'REPORT' ? 'Report' : 'Update'}</Badge>
                      <span className="text-xs text-ink-muted">{date(r.publishedAt, 'long')}</span>
                    </div>
                    <h3 className="mt-2 font-heading text-xl">{r.title}</h3>
                    {r.body && <Markdown className="prose-base mt-2 text-ink-muted">{r.body}</Markdown>}
                    {r.fileUrl && (
                      <a href={r.fileUrl} target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-sm mt-4" download>
                        <Download className="h-4 w-4" aria-hidden /> Download {r.kind === 'REPORT' ? 'report' : 'file'}
                      </a>
                    )}
                  </div>
                </Reveal>
              ))}
            </ol>
          </Block>
        )}

        {p.stories.length > 0 && (
          <Block title="Stories from this project" eyebrow="Stories" id="project-stories" className="mt-20">
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {p.stories.map((s, i) => <Reveal key={s.id} delay={i * 0.08}><StoryCard s={s} /></Reveal>)}
            </div>
          </Block>
        )}

        {p.opportunities.length > 0 && (
          <Block title="Volunteer on this project" eyebrow="Get involved" id="project-volunteer" className="mt-20" action={<ButtonLink href="/volunteer" variant="ghost" className="text-primary">All opportunities</ButtonLink>}>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {p.opportunities.map((o) => <OpportunityCard key={o.id} o={o} />)}
            </div>
          </Block>
        )}

        <div className="mt-16 border-t border-line pt-8"><ShareButtons title={p.title} /></div>
      </div>
    </>
  );
}
