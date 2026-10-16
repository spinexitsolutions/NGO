import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { BadgeCheck, Briefcase, Clock, Download, ExternalLink, FileText, HandCoins, Linkedin, Mail, MapPin, Phone, Plus, Quote, Users } from 'lucide-react';
import { INQUIRY_TYPES, type InquiryType } from '@ngo/shared';
import { useSite } from '@/app/SiteProvider';
import { cn } from '@/lib/cn';
import { date, money } from '@/lib/format';
import { useCollection, usePublic } from '@/lib/queries';
import type { Album, Campaign, Cause, DocumentItem, EventItem, Faq, ImpactStat, Job, Opportunity, Partner, Post, Project, Story, TeamMember, Testimonial } from '@/lib/types';
import { Badge, ButtonLink, CardGridSkeleton, SmartLink } from '@/components/ui';
import { CampaignCard, CauseCard, EventCard, PostCard, ProjectCard, StoryCard } from '@/components/site/cards';
import { InquiryForm, NewsletterForm } from '@/components/site/forms';
import { Icon } from '@/components/site/Icon';
import { Gallery } from '@/components/site/Lightbox';
import { Markdown } from '@/components/site/Markdown';
import { Counter, Parallax, Reveal } from '@/components/site/motion';
import { SampleBadge } from '@/components/site/SampleBadge';
import { SectionHeader } from '@/components/site/SectionHeader';
import { SmartImage } from '@/components/site/SmartImage';
import { arr, num, str, type SectionProps } from './types';

function header(props: Record<string, unknown>, link?: string) {
  return { eyebrow: str(props.eyebrow), heading: str(props.heading), intro: str(props.intro), link: link ? { href: link, label: str(props.linkLabel) } : undefined };
}

export function StatsSection({ props }: SectionProps) {
  const { data, isLoading } = useCollection<ImpactStat>('impactStats');
  const stats = data?.data ?? [];
  if (!isLoading && !stats.length) return null;
  const bg = str(props.background, 'primary');
  const dark = bg !== 'light';
  const anySample = stats.some((s) => s.isSample || !s.isVerified);
  return (
    <div className={cn('relative isolate overflow-hidden', dark && 'on-dark text-white', bg === 'primary' && 'bg-primary', bg === 'light' && 'bg-surface-alt')}>
      {bg === 'image' && str(props.image) && (
        <>
          <Parallax className="-z-10"><SmartImage src={str(props.image)} alt="" sizes="100vw" width={2200} /></Parallax>
          <div className="absolute inset-0 -z-10 bg-secondary/85" />
        </>
      )}
      <div className="section-y container-x">
        <SectionHeader {...header(props)} dark={dark} align="center" />
        <div className="grid grid-cols-2 gap-x-6 gap-y-12 lg:grid-cols-4">
          {stats.map((s, n) => (
            <Reveal key={s.id} delay={n * 0.08} className="text-center">
              <span className={cn('mx-auto grid h-12 w-12 place-items-center rounded-full', dark ? 'bg-white/10 text-accent' : 'bg-primary/10 text-primary')}><Icon name={s.icon} className="h-6 w-6" /></span>
              <p className="mt-5 font-heading text-4xl sm:text-5xl lg:text-6xl" title={s.source || undefined}>
                <Counter value={s.value} prefix={s.prefix} suffix={s.suffix} />
              </p>
              <p className={cn('mt-2 text-sm sm:text-base', dark ? 'text-white/75' : 'text-ink-muted')}>{s.label}</p>
            </Reveal>
          ))}
        </div>
        {(str(props.footnote) || anySample) && (
          <p className={cn('mt-14 text-center text-xs', dark ? 'text-white/55' : 'text-ink-muted')}>
            {anySample && <SampleBadge show className="mr-2 align-middle" />}
            {str(props.footnote)}
          </p>
        )}
      </div>
    </div>
  );
}

export function CausesSection({ props }: SectionProps) {
  const { data, isLoading } = useCollection<Cause>('causes', { limit: num(props.limit, 6) });
  const items = data?.data ?? [];
  if (!isLoading && !items.length) return null;
  const feature = props.layout === 'feature' && items.length > 2;
  return (
    <div className="container-x">
      <SectionHeader {...header(props, '/causes')} />
      {isLoading ? (
        <CardGridSkeleton />
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((c, n) => (
            <Reveal key={c.id} delay={(n % 3) * 0.08} className={cn(feature && n === 0 && 'sm:col-span-2 lg:col-span-3')}>
              <CauseCard cause={c} featured={feature && n === 0} />
            </Reveal>
          ))}
        </div>
      )}
    </div>
  );
}

export function CampaignsSection({ props }: SectionProps) {
  const { data, isLoading } = usePublic<Campaign[]>(`/public/campaigns?phase=active&limit=${num(props.limit, 3)}${props.featuredOnly ? '&featured=true' : ''}`);
  const items = data ?? [];
  if (!isLoading && !items.length) return null;
  return (
    <div className="container-x">
      <SectionHeader {...header(props, '/campaigns')} />
      {isLoading ? (
        <CardGridSkeleton />
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((c, n) => (
            <Reveal key={c.id} delay={n * 0.08}><CampaignCard c={c} /></Reveal>
          ))}
        </div>
      )}
    </div>
  );
}

export function ProjectsSection({ props }: SectionProps) {
  const { data, isLoading } = useCollection<Project>('projects', { limit: num(props.limit, 3) });
  const items = data?.data ?? [];
  if (!isLoading && !items.length) return null;
  return (
    <div className="container-x">
      <SectionHeader {...header(props, '/projects')} />
      {isLoading ? <CardGridSkeleton /> : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((p, n) => <Reveal key={p.id} delay={n * 0.08}><ProjectCard p={p} /></Reveal>)}
        </div>
      )}
    </div>
  );
}

export function StoriesSection({ props }: SectionProps) {
  const { data, isLoading } = useCollection<Story>('stories', { limit: num(props.limit, 3) });
  const items = data?.data ?? [];
  if (!isLoading && !items.length) return null;
  return (
    <div className="container-x">
      <SectionHeader {...header(props, '/stories')} />
      {isLoading ? <CardGridSkeleton /> : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((s, n) => <Reveal key={s.id} delay={n * 0.08}><StoryCard s={s} /></Reveal>)}
        </div>
      )}
    </div>
  );
}

export function EventsSection({ props }: SectionProps) {
  const { data, isLoading } = useCollection<EventItem>('events', { limit: num(props.limit, 3) });
  const items = data?.data ?? [];
  if (!isLoading && !items.length) return null;
  return (
    <div className="container-x">
      <SectionHeader {...header(props, '/events')} />
      <div className="grid gap-6 lg:grid-cols-2">
        {items.map((e, n) => <Reveal key={e.id} delay={n * 0.08} className={cn(n === 0 && items.length % 2 === 1 && 'lg:col-span-2')}><EventCard e={e} /></Reveal>)}
      </div>
    </div>
  );
}

export function PostsSection({ props }: SectionProps) {
  const { data, isLoading } = usePublic<Post[]>(`/public/posts?limit=${num(props.limit, 3)}`);
  const items = data ?? [];
  if (!isLoading && !items.length) return null;
  return (
    <div className="container-x">
      <SectionHeader {...header(props, '/blog')} />
      {isLoading ? <CardGridSkeleton /> : (
        <div className="grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((p, n) => <Reveal key={p.id} delay={n * 0.08}><PostCard p={p} /></Reveal>)}
        </div>
      )}
    </div>
  );
}

export function TestimonialsSection({ props }: SectionProps) {
  const { data, isLoading } = useCollection<Testimonial>('testimonials', { limit: num(props.limit, 6) });
  const items = data?.data ?? [];
  const [i, setI] = useState(0);
  if (isLoading || !items.length) return null;
  const t = items[i % items.length];
  return (
    <div className="container-x max-w-5xl text-center">
      <SectionHeader {...header(props)} align="center" />
      <div className="relative min-h-[260px]">
        <Quote className="mx-auto h-12 w-12 text-accent" aria-hidden />
        <AnimatePresence mode="wait">
          <motion.figure key={t.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.5 }}>
            <blockquote className="mt-6 font-heading text-2xl leading-snug sm:text-3xl">“{t.quote}”</blockquote>
            <figcaption className="mt-8 flex items-center justify-center gap-4">
              {t.photo && <span className="h-14 w-14 overflow-hidden rounded-full"><SmartImage src={t.photo} alt="" width={200} sizes="56px" /></span>}
              <span className="text-left"><strong className="block">{t.author}</strong><span className="text-sm text-ink-muted">{t.role}</span></span>
            </figcaption>
          </motion.figure>
        </AnimatePresence>
      </div>
      {items.length > 1 && (
        <div className="mt-10 flex justify-center gap-2">
          {items.map((x, n) => <button key={x.id} onClick={() => setI(n)} aria-label={`Testimonial ${n + 1}`} aria-current={n === i % items.length} className={cn('h-2 rounded-full transition-all', n === i % items.length ? 'w-8 bg-primary' : 'w-2 bg-ink/20')} />)}
        </div>
      )}
    </div>
  );
}

export function PartnersSection({ props }: SectionProps) {
  const type = str(props.partnerType, 'all');
  const { data, isLoading } = useCollection<Partner>('partners', { type, limit: 60 });
  const items = data?.data ?? [];
  if (isLoading || !items.length) return null;
  return (
    <div className="container-x">
      <SectionHeader {...header(props)} align="center" />
      <ul className="grid grid-cols-2 items-center gap-6 sm:grid-cols-3 lg:grid-cols-5">
        {items.map((p) => (
          <li key={p.id} className="flex h-24 items-center justify-center rounded-2xl border border-line bg-surface px-6">
            <SmartLink href={p.url || '#'} className="flex h-full w-full items-center justify-center grayscale transition hover:grayscale-0" aria-label={p.name}>
              {p.logo ? <img src={p.logo} alt={p.name} loading="lazy" className="max-h-12 w-auto object-contain" /> : <span className="font-heading text-lg">{p.name}</span>}
            </SmartLink>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function TeamSection({ props }: SectionProps) {
  const group = str(props.group, 'all');
  const { data, isLoading } = useCollection<TeamMember>('team', { group, limit: 100 });
  const items = data?.data ?? [];
  if (!isLoading && !items.length) return null;
  return (
    <div className="container-x">
      <SectionHeader {...header(props)} />
      {isLoading ? <CardGridSkeleton count={4} /> : (
        <ul className="grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((m, n) => (
            <Reveal as="li" key={m.id} delay={(n % 4) * 0.06}>
              <div className="group relative aspect-[4/5] overflow-hidden rounded-theme-img bg-surface-alt">
                <SmartImage src={m.photo} alt={`Portrait of ${m.name}`} sizes="(min-width:1024px) 25vw, 50vw" width={700} className="grayscale-[30%] transition duration-700 group-hover:scale-105 group-hover:grayscale-0" />
                <SampleBadge show={m.isSample} className="absolute left-3 top-3" />
                {m.linkedinUrl && (
                  <a href={m.linkedinUrl} target="_blank" rel="noopener noreferrer" className="absolute bottom-3 right-3 grid h-10 w-10 place-items-center rounded-full bg-white text-primary opacity-0 shadow-lg transition group-hover:opacity-100 focus:opacity-100" aria-label={`${m.name} on LinkedIn`}>
                    <Linkedin className="h-4 w-4" />
                  </a>
                )}
              </div>
              <h3 className="mt-4 font-heading text-xl">{m.name}</h3>
              <p className="text-sm font-medium text-accent">{m.title}</p>
              {m.bio && <p className="mt-2 line-clamp-3 text-sm text-ink-muted">{m.bio}</p>}
            </Reveal>
          ))}
        </ul>
      )}
    </div>
  );
}

export function GallerySection({ props }: SectionProps) {
  const slug = str(props.albumSlug);
  const { data } = usePublic<Album>(`/public/c/galleryAlbums/${slug}`, Boolean(slug));
  const images = slug ? (data?.items ?? []) : arr<string>(props.images).map((url) => ({ url, alt: '', caption: '' }));
  const shown = images.slice(0, num(props.limit, 9));
  if (!shown.length) return null;
  return (
    <div className="container-x">
      <SectionHeader {...header(props, slug ? `/gallery/${slug}` : '/gallery')} link={{ href: slug ? `/gallery/${slug}` : '/gallery', label: 'View gallery' }} />
      <Gallery images={shown} />
    </div>
  );
}

export function FaqSection({ props }: SectionProps) {
  const category = str(props.category);
  const { data, isLoading } = useCollection<Faq>('faqs', { category: category || undefined, limit: 100 });
  const items = data?.data ?? [];
  const [open, setOpen] = useState<string | null>(null);
  if (!isLoading && !items.length) return null;
  return (
    <div className="container-x grid gap-12 lg:grid-cols-[1fr_1.6fr]">
      <SectionHeader {...header(props)} className="lg:mb-0" />
      <div className="divide-y divide-line border-y border-line">
        {items.map((f) => {
          const isOpen = open === f.id;
          return (
            <div key={f.id}>
              <h3>
                <button className="flex w-full items-center justify-between gap-6 py-6 text-left text-lg font-medium" aria-expanded={isOpen} aria-controls={`faq-${f.id}`} onClick={() => setOpen(isOpen ? null : f.id)}>
                  {f.question}
                  <Plus className={cn('h-5 w-5 shrink-0 text-primary transition-transform duration-300', isOpen && 'rotate-45')} aria-hidden />
                </button>
              </h3>
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div id={`faq-${f.id}`} initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                    <Markdown className="pb-6 prose-p:text-ink-muted">{f.answer}</Markdown>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const DOC_LABEL: Record<string, string> = { ANNUAL_REPORT: 'Annual report', FINANCIAL_STATEMENT: 'Financial statement', AUDIT_REPORT: 'Audit report', IMPACT_REPORT: 'Impact report', POLICY: 'Policy', REGISTRATION: 'Registration' };

export function DocumentsSection({ props }: SectionProps) {
  const type = str(props.docType, 'all');
  const { data, isLoading } = useCollection<DocumentItem>('documents', { type, limit: 100 });
  const items = data?.data ?? [];
  return (
    <div className="container-x">
      <SectionHeader {...header(props)} />
      {isLoading ? <CardGridSkeleton /> : items.length ? (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((d) => (
            <li key={d.id}>
              <a href={d.fileUrl} target="_blank" rel="noopener noreferrer" className="card card-hover group flex h-full items-start gap-4 p-6">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><FileText className="h-6 w-6" aria-hidden /></span>
                <span className="flex-1">
                  <span className="text-xs font-semibold uppercase tracking-wider text-accent">{DOC_LABEL[d.type] ?? d.type} {d.year && `· ${d.year}`}</span>
                  <span className="mt-1 block font-semibold">{d.title}</span>
                  {d.description && <span className="mt-1 block text-sm text-ink-muted">{d.description}</span>}
                </span>
                <Download className="h-5 w-5 shrink-0 text-ink-muted transition group-hover:text-primary" aria-label="Download" />
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-2xl border border-dashed border-line p-8 text-center text-ink-muted">Documents will be published here soon.</p>
      )}
    </div>
  );
}

export function FundUtilisationSection({ props }: SectionProps) {
  const items = arr<{ label: string; percent: number }>(props.items);
  if (!items.length) return null;
  const colours = ['rgb(var(--c-primary))', 'rgb(var(--c-accent))', 'rgb(var(--c-secondary))', '#7FA392', '#D9C9A3', '#9AA39D'];
  let acc = 0;
  const stops = items.map((it, n) => {
    const from = acc;
    acc += it.percent;
    return `${colours[n % colours.length]} ${from}% ${acc}%`;
  });
  return (
    <div className="container-x grid items-center gap-12 lg:grid-cols-2">
      <div>
        <SectionHeader {...header(props)} className="mb-8" />
        <ul className="space-y-5">
          {items.map((it, n) => (
            <Reveal as="li" key={it.label} delay={n * 0.08}>
              <div className="flex items-center justify-between text-sm font-medium">
                <span className="flex items-center gap-2"><span className="h-3 w-3 rounded-full" style={{ background: colours[n % colours.length] }} />{it.label}</span>
                <span className="font-heading text-xl">{it.percent}%</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-ink/10">
                <motion.div className="h-full rounded-full" style={{ background: colours[n % colours.length] }} initial={{ width: 0 }} whileInView={{ width: `${it.percent}%` }} viewport={{ once: true }} transition={{ duration: 1.4, delay: 0.2 + n * 0.1 }} />
              </div>
            </Reveal>
          ))}
        </ul>
        <div className="mt-8 flex flex-wrap items-center gap-3 text-sm text-ink-muted">
          {Boolean(props.isSample) && <SampleBadge show />}
          {str(props.period) && <span>{str(props.period)}</span>}
          {str(props.sourceHref) && (
            <SmartLink href={str(props.sourceHref)} className="inline-flex items-center gap-1 font-semibold text-primary">
              {str(props.sourceLabel) || 'Source'} <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            </SmartLink>
          )}
        </div>
      </div>
      <Reveal className="relative mx-auto aspect-square w-full max-w-sm">
        <motion.div className="absolute inset-0 rounded-full" style={{ background: `conic-gradient(${stops.join(', ')}, rgb(var(--c-border)) ${acc}% 100%)` }} initial={{ rotate: -90, scale: 0.9, opacity: 0 }} whileInView={{ rotate: 0, scale: 1, opacity: 1 }} viewport={{ once: true }} transition={{ duration: 1.4, ease: [0.22, 1, 0.36, 1] }} role="img" aria-label={items.map((i) => `${i.label} ${i.percent}%`).join(', ')} />
        <div className="absolute inset-[18%] grid place-items-center rounded-full bg-bg text-center">
          <div>
            <p className="font-heading text-5xl text-primary">{items[0].percent}%</p>
            <p className="mt-1 text-sm text-ink-muted">{items[0].label}</p>
          </div>
        </div>
      </Reveal>
    </div>
  );
}

export function DonationBannerSection({ props }: SectionProps) {
  const { settings } = useSite();
  const amounts = settings.donation.presetAmounts;
  const [amount, setAmount] = useState(amounts[1] ?? amounts[0]);
  const lines = arr<string>(props.impactLines);
  const slug = str(props.campaignSlug);
  const href = `/donate?amount=${amount}${slug ? `&campaign=${encodeURIComponent(slug)}` : ''}`;
  return (
    <div className="container-x">
      <div className="card grid overflow-hidden lg:grid-cols-2">
        <div className="relative min-h-[280px]">
          <SmartImage src={str(props.image)} alt="" sizes="(min-width:1024px) 50vw, 100vw" width={1400} />
          <div className="absolute inset-0 bg-gradient-to-t from-secondary/70 to-transparent lg:bg-gradient-to-r" />
          {lines.length > 0 && (
            <ul className="on-dark absolute inset-x-6 bottom-6 space-y-2 text-sm text-white">
              {lines.map((l) => <li key={l} className="flex gap-2"><HandCoins className="h-4 w-4 shrink-0 text-accent" aria-hidden /> {l}</li>)}
            </ul>
          )}
        </div>
        <div className="p-8 sm:p-12">
          {str(props.eyebrow) && <p className="eyebrow mb-4">{str(props.eyebrow)}</p>}
          <h2 className="h-section">{str(props.heading)}</h2>
          {str(props.body) && <p className="mt-4 text-ink-muted">{str(props.body)}</p>}
          <fieldset className="mt-8">
            <legend className="sr-only">Choose an amount</legend>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {amounts.map((a) => (
                <button key={a} type="button" onClick={() => setAmount(a)} aria-pressed={a === amount} className={cn('rounded-xl border px-3 py-3.5 font-heading text-lg transition', a === amount ? 'border-primary bg-primary text-primary-contrast shadow-lg' : 'border-line bg-surface hover:border-primary')}>
                  {money(a, settings.donation.currency)}
                </button>
              ))}
            </div>
          </fieldset>
          <ButtonLink href={href} variant="accent" className="mt-6 w-full sm:w-auto">Donate {money(amount, settings.donation.currency)}</ButtonLink>
          <p className="mt-4 text-xs text-ink-muted">Secure payment · Instant receipt by email</p>
        </div>
      </div>
    </div>
  );
}

export function NewsletterSection({ props, section }: SectionProps) {
  const dark = section.background === 'dark';
  return (
    <div className="container-x max-w-3xl text-center">
      {str(props.eyebrow) && <p className="eyebrow mb-4 justify-center">{str(props.eyebrow)}</p>}
      <h2 className={cn('h-section', dark && 'text-white')}>{str(props.heading)}</h2>
      {str(props.body) && <p className={cn('lead mx-auto mt-4 max-w-xl', dark && 'text-white/75')}>{str(props.body)}</p>}
      <div className="mx-auto mt-8 max-w-xl text-left"><NewsletterForm dark={dark} source="section" /></div>
    </div>
  );
}

export function ContactSection({ props }: SectionProps) {
  const { settings } = useSite();
  const c = settings.contact;
  return (
    <div className="container-x grid gap-12 lg:grid-cols-[1fr_1.4fr]">
      <div>
        <SectionHeader {...header(props)} className="mb-8" />
        <ul className="space-y-5">
          {c.address && <li className="flex gap-4"><MapPin className="mt-1 h-5 w-5 shrink-0 text-primary" aria-hidden /><span>{c.address}</span></li>}
          {c.phone && <li className="flex gap-4"><Phone className="mt-1 h-5 w-5 shrink-0 text-primary" aria-hidden /><a href={`tel:${c.phone.replace(/\s/g, '')}`} className="hover:underline">{c.phone}</a></li>}
          {c.email && <li className="flex gap-4"><Mail className="mt-1 h-5 w-5 shrink-0 text-primary" aria-hidden /><a href={`mailto:${c.email}`} className="hover:underline">{c.email}</a></li>}
          {c.hours && <li className="flex gap-4"><Clock className="mt-1 h-5 w-5 shrink-0 text-primary" aria-hidden /><span>{c.hours}</span></li>}
          {c.whatsapp && <li className="flex gap-4"><Users className="mt-1 h-5 w-5 shrink-0 text-primary" aria-hidden /><a href={`https://wa.me/${c.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="hover:underline">Message us on WhatsApp</a></li>}
        </ul>
        {Boolean(props.showMap) && c.mapEmbedUrl && (
          <div className="mt-8 aspect-[4/3] overflow-hidden rounded-theme-img border border-line">
            <iframe src={c.mapEmbedUrl} title="Map of our office" loading="lazy" referrerPolicy="no-referrer-when-downgrade" className="h-full w-full" />
          </div>
        )}
      </div>
      <InquiryForm type="GENERAL" />
    </div>
  );
}

export function InquiryFormSection({ props }: SectionProps) {
  const t = str(props.formType, 'GENERAL');
  const type = (INQUIRY_TYPES as readonly string[]).includes(t) ? (t as InquiryType) : 'GENERAL';
  return (
    <div className="container-x grid gap-10 lg:grid-cols-[1fr_1.5fr]">
      <SectionHeader {...header(props)} className="lg:mb-0" />
      <InquiryForm type={type} submitLabel={str(props.submitLabel) || 'Send'} successMessage={str(props.successMessage) || undefined} />
    </div>
  );
}

export function OpportunitiesSection({ props }: SectionProps) {
  const { data, isLoading } = useCollection<Opportunity>('opportunities', { limit: num(props.limit, 6) });
  const items = data?.data ?? [];
  return (
    <div className="container-x">
      <SectionHeader {...header(props)} />
      {isLoading ? <CardGridSkeleton /> : items.length ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {items.map((o) => <OpportunityCard key={o.id} o={o} />)}
        </div>
      ) : (
        <p className="rounded-2xl border border-dashed border-line p-8 text-center text-ink-muted">No open roles right now — you can still <Link className="font-semibold text-primary underline" to="/volunteer/apply">apply as a general volunteer</Link>.</p>
      )}
    </div>
  );
}

export function OpportunityCard({ o }: { o: Opportunity }) {
  return (
    <div className="card flex h-full flex-col p-7">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="brand">{o.mode === 'REMOTE' ? 'Remote' : o.mode === 'HYBRID' ? 'Hybrid' : 'On site'}</Badge>
        <SampleBadge show={o.isSample} />
      </div>
      <h3 className="mt-4 font-heading text-2xl">{o.title}</h3>
      <p className="mt-2 text-sm text-ink-muted">{o.summary}</p>
      <ul className="mt-4 space-y-1.5 text-sm text-ink-muted">
        {o.location && <li className="flex items-center gap-2"><MapPin className="h-4 w-4" aria-hidden /> {o.location}</li>}
        {o.commitment && <li className="flex items-center gap-2"><Clock className="h-4 w-4" aria-hidden /> {o.commitment}</li>}
        {o.deadline && <li className="flex items-center gap-2"><Briefcase className="h-4 w-4" aria-hidden /> Apply by {date(o.deadline)}</li>}
      </ul>
      {o.skills.length > 0 && <div className="mt-4 flex flex-wrap gap-1.5">{o.skills.map((s) => <span key={s} className="chip">{s}</span>)}</div>}
      <div className="mt-auto pt-6"><ButtonLink href={`/volunteer/apply?opportunity=${o.slug}`} size="sm">Apply</ButtonLink></div>
    </div>
  );
}

export function JobsSection({ props }: SectionProps) {
  const { data, isLoading } = useCollection<Job>('jobs', { limit: 50 });
  const items = data?.data ?? [];
  const [open, setOpen] = useState<string | null>(null);
  return (
    <div className="container-x">
      <SectionHeader {...header(props)} />
      {isLoading ? <CardGridSkeleton count={2} /> : items.length ? (
        <ul className="divide-y divide-line rounded-theme-img border border-line bg-surface">
          {items.map((j) => (
            <li key={j.id} className="p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap gap-2"><Badge tone="brand">{j.type.toLowerCase()}</Badge><SampleBadge show={j.isSample} /></div>
                  <h3 className="mt-2 font-heading text-2xl">{j.title}</h3>
                  <p className="mt-1 text-sm text-ink-muted">{[j.location, j.deadline && `Apply by ${date(j.deadline)}`].filter(Boolean).join(' · ')}</p>
                  <p className="mt-2 text-ink-muted">{j.summary}</p>
                </div>
                <button className="btn btn-outline btn-sm" aria-expanded={open === j.id} onClick={() => setOpen(open === j.id ? null : j.id)}>{open === j.id ? 'Hide details' : 'View details'}</button>
              </div>
              {open === j.id && <Markdown className="mt-6 border-t border-line pt-6">{j.description}</Markdown>}
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-2xl border border-dashed border-line p-8 text-center text-ink-muted">There are no open positions at the moment.</p>
      )}
    </div>
  );
}

export function CredentialsSection({ props }: SectionProps) {
  const { settings } = useSite();
  const r = settings.registration;
  return (
    <div className="container-x">
      <SectionHeader {...header(props)} />
      {r.verified ? (
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            ['Legal name', r.legalName],
            [r.registrationType || 'Registration', r.registrationNumber],
            ['PAN', r.pan],
            ...r.otherCredentials.map((c) => [c.label, c.value]),
          ]
            .filter(([, v]) => v)
            .map(([k, v]) => (
              <div key={k} className="card flex items-start gap-4 p-6">
                <BadgeCheck className="mt-0.5 h-6 w-6 shrink-0 text-primary" aria-hidden />
                <div><dt className="text-xs font-semibold uppercase tracking-wider text-ink-muted">{k}</dt><dd className="mt-1 font-semibold">{v}</dd></div>
              </div>
            ))}
        </dl>
      ) : (
        <p className="rounded-2xl border border-dashed border-line p-8 text-center text-ink-muted">Registration details will be published here once verified.</p>
      )}
    </div>
  );
}
