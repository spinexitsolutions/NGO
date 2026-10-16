import { useParams } from 'react-router-dom';
import { HandHeart, Heart } from 'lucide-react';
import { usePublic } from '@/lib/queries';
import type { Campaign, Cause, Project, Story } from '@/lib/types';
import { ButtonLink } from '@/components/ui';
import { CampaignCard, ProjectCard, StoryCard } from '@/components/site/cards';
import { Gallery } from '@/components/site/Lightbox';
import { Markdown } from '@/components/site/Markdown';
import { Reveal } from '@/components/site/motion';
import { Seo } from '@/components/site/Seo';
import { ShareButtons } from '@/components/site/ShareButtons';
import { Icon } from '@/components/site/Icon';
import { Block, DetailBanner, QueryGate, TickList, toGallery } from './page-kit';

type CauseDetail = Cause & { campaigns: Campaign[]; projects: Project[]; stories: Story[] };

export default function CauseDetailPage() {
  const { slug = '' } = useParams();
  const query = usePublic<CauseDetail>(`/public/causes/${slug}`);
  return <QueryGate query={query}>{(c) => <CauseView c={c} />}</QueryGate>;
}

function DonateCta({ c, className }: { c: CauseDetail; className?: string }) {
  return (
    <div className={className}>
      <div className="card overflow-hidden">
        <div className="bg-primary p-7 text-primary-contrast on-dark">
          <span className="grid h-12 w-12 place-items-center rounded-full bg-white/15 text-accent"><Icon name={c.icon} className="h-6 w-6" /></span>
          <p className="mt-5 font-heading text-2xl leading-snug">Support {c.title.toLowerCase()}</p>
          <p className="mt-2 text-sm text-white/80">Your gift goes to programmes in this area. You’ll get an instant receipt by email.</p>
        </div>
        <div className="space-y-3 p-6">
          <ButtonLink href={`/donate?cause=${encodeURIComponent(c.slug)}`} icon={Heart} className="w-full">Donate to this cause</ButtonLink>
          <ButtonLink href="/volunteer" variant="outline" className="w-full">Volunteer with us</ButtonLink>
        </div>
      </div>
      <div className="mt-6"><ShareButtons title={c.title} /></div>
    </div>
  );
}

function CauseView({ c }: { c: CauseDetail }) {
  const gallery = toGallery(c.gallery, c.title);
  const hasLists = [c.goals, c.activities, c.outcomes].some((l) => l?.length);
  return (
    <>
      <Seo title={c.seoTitle || c.title} description={c.seoDescription || c.summary} image={c.coverImage} />
      <DetailBanner image={c.coverImage} alt={c.coverAlt} eyebrow="Our cause" title={c.title} subtitle={c.summary} isSample={c.isSample} back={{ href: '/causes', label: 'All causes' }}>
        <div className="flex flex-wrap gap-3">
          <ButtonLink href={`/donate?cause=${encodeURIComponent(c.slug)}`} variant="accent" icon={HandHeart}>Donate to this cause</ButtonLink>
        </div>
      </DetailBanner>

      <div className="container-x section-y">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-16">
          <div className="min-w-0">
            {c.body && (
              <Reveal>
                <Markdown>{c.body}</Markdown>
              </Reveal>
            )}
            {hasLists && (
              <div className="mt-14 grid gap-5 md:grid-cols-2">
                <TickList title="Our goals" items={c.goals} />
                <TickList title="What we do" items={c.activities} />
                <TickList title="Outcomes we track" items={c.outcomes} className="md:col-span-2" />
              </div>
            )}
          </div>
          <aside className="lg:sticky lg:top-28 lg:self-start" aria-label="Support this cause">
            <DonateCta c={c} />
          </aside>
        </div>

        {gallery.length > 0 && (
          <Block title="In pictures" eyebrow="Gallery" id="cause-gallery" className="mt-20">
            <Gallery images={gallery} />
          </Block>
        )}

        {c.campaigns.length > 0 && (
          <Block title="Campaigns you can support" eyebrow="Fundraising now" id="cause-campaigns" className="mt-20" action={<ButtonLink href={`/campaigns?cause=${c.slug}`} variant="ghost" className="text-primary">All campaigns</ButtonLink>}>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {c.campaigns.map((x, i) => <Reveal key={x.id} delay={i * 0.08}><CampaignCard c={x} /></Reveal>)}
            </div>
          </Block>
        )}

        {c.projects.length > 0 && (
          <Block title="Projects on the ground" eyebrow="Projects" id="cause-projects" className="mt-20">
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {c.projects.map((p, i) => <Reveal key={p.id} delay={(i % 3) * 0.08}><ProjectCard p={p} /></Reveal>)}
            </div>
          </Block>
        )}

        {c.stories.length > 0 && (
          <Block title="Stories of change" eyebrow="Stories" id="cause-stories" className="mt-20">
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {c.stories.map((s, i) => <Reveal key={s.id} delay={i * 0.08}><StoryCard s={s} /></Reveal>)}
            </div>
          </Block>
        )}

        <Reveal className="mt-20 overflow-hidden rounded-theme-img bg-secondary p-8 text-white on-dark sm:p-12">
          <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
            <div className="max-w-2xl">
              <p className="eyebrow">Make it happen</p>
              <h2 className="mt-3 font-heading text-[1.75rem] leading-tight sm:text-fs-3">Every contribution to {c.title.toLowerCase()} counts.</h2>
            </div>
            <ButtonLink href={`/donate?cause=${encodeURIComponent(c.slug)}`} variant="accent" icon={Heart}>Donate to this cause</ButtonLink>
          </div>
        </Reveal>
      </div>
    </>
  );
}
