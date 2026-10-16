import { Component, type ComponentType, type ReactNode } from 'react';
import type { Section, SectionType } from '@ngo/shared';
import { cn } from '@/lib/cn';
import * as D from './DataSections';
import * as H from './HeroSections';
import type { SectionProps } from './types';

const REGISTRY: Record<SectionType, ComponentType<SectionProps>> = {
  hero: H.HeroSection,
  imageText: H.ImageTextSection,
  missionVision: H.MissionVisionSection,
  cta: H.CtaSection,
  richText: H.RichTextSection,
  iconCards: H.IconCardsSection,
  steps: H.StepsSection,
  timeline: H.TimelineSection,
  video: H.VideoSection,
  stats: D.StatsSection,
  causes: D.CausesSection,
  campaigns: D.CampaignsSection,
  projects: D.ProjectsSection,
  stories: D.StoriesSection,
  events: D.EventsSection,
  posts: D.PostsSection,
  testimonials: D.TestimonialsSection,
  partners: D.PartnersSection,
  team: D.TeamSection,
  gallery: D.GallerySection,
  faq: D.FaqSection,
  documents: D.DocumentsSection,
  fundUtilisation: D.FundUtilisationSection,
  donationBanner: D.DonationBannerSection,
  newsletter: D.NewsletterSection,
  contact: D.ContactSection,
  inquiryForm: D.InquiryFormSection,
  opportunities: D.OpportunitiesSection,
  jobs: D.JobsSection,
  credentials: D.CredentialsSection,
};

/** Sections that manage their own full-bleed background and spacing. */
const FULL_BLEED = new Set<SectionType>(['hero', 'stats']);

/** A broken section never takes the whole page down. */
class SectionBoundary extends Component<{ children: ReactNode; type: string }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override render() {
    return this.state.failed ? null : this.props.children;
  }
}

export function SectionView({ section, isFirst }: { section: Section; isFirst: boolean }) {
  const C = REGISTRY[section.type as SectionType];
  if (!C || !section.visible) return null;
  const full = FULL_BLEED.has(section.type as SectionType);
  const bg = { default: '', alt: 'bg-surface-alt', dark: 'on-dark bg-secondary text-white' }[section.background] ?? '';
  return (
    <section id={section.anchor || undefined} data-section={section.type} className={cn('empty:hidden', !full && 'section-y', !full && bg)}>
      <SectionBoundary type={section.type}>
        <C section={section} props={section.props} isFirst={isFirst} />
      </SectionBoundary>
    </section>
  );
}

export function SectionList({ sections, insertAfterFirst }: { sections: Section[]; insertAfterFirst?: ReactNode }) {
  const visible = sections.filter((s) => s.visible);
  return (
    <>
      {visible.map((s, i) => (
        <SectionGroup key={s.id} section={s} isFirst={i === 0} after={i === 0 ? insertAfterFirst : undefined} />
      ))}
      {visible.length === 0 && insertAfterFirst}
    </>
  );
}

function SectionGroup({ section, isFirst, after }: { section: Section; isFirst: boolean; after?: ReactNode }) {
  return (
    <>
      <SectionView section={section} isFirst={isFirst} />
      {after}
    </>
  );
}
