import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, ChevronDown, Check, Quote } from 'lucide-react';
import { useMotionEnabled, useSite } from '@/app/SiteProvider';
import { cn } from '@/lib/cn';
import { ButtonLink, SmartLink } from '@/components/ui';
import { Icon } from '@/components/site/Icon';
import { Markdown } from '@/components/site/Markdown';
import { Parallax, Reveal } from '@/components/site/motion';
import { useHeaderOverlay } from '@/components/site/Layout';
import { SmartImage } from '@/components/site/SmartImage';
import { SectionHeader } from '@/components/site/SectionHeader';
import { arr, num, str, type Cta, type SectionProps } from './types';

export function Ctas({ ctas, dark, className }: { ctas: Cta[]; dark?: boolean; className?: string }) {
  if (!ctas.length) return null;
  return (
    <div className={cn('flex flex-wrap items-center gap-3', className)}>
      {ctas.map((c, i) => (
        <ButtonLink key={i} href={c.href} variant={c.variant} className={cn(c.variant === 'ghost' && dark && 'text-white', c.variant === 'outline' && dark && 'text-white')} icon={c.variant === 'ghost' ? ArrowRight : undefined}>
          {c.label}
        </ButtonLink>
      ))}
    </div>
  );
}

/** Cinematic hero with cross-fading Ken Burns slideshow. */
export function HeroSection({ props, isFirst }: SectionProps) {
  const { theme } = useSite();
  const setOverlay = useHeaderOverlay();
  const motionOn = useMotionEnabled();
  const images = arr<string>(props.images).filter(Boolean);
  const alts = arr<string>(props.imageAlts);
  const [i, setI] = useState(0);
  const height = str(props.height, 'full');
  const center = props.layout === 'center';
  const overlay = num(props.overlay, 50) / 100;
  const hasImage = images.length > 0;
  const overHero = isFirst && hasImage && theme.layout.headerStyle === 'transparent';

  useEffect(() => {
    if (!isFirst) return;
    setOverlay(overHero);
    return () => setOverlay(false);
  }, [isFirst, overHero, setOverlay]);

  useEffect(() => {
    if (images.length < 2 || !motionOn) return;
    const id = setInterval(() => setI((x) => (x + 1) % images.length), 7000);
    return () => clearInterval(id);
  }, [images.length, motionOn]);

  const heights = { full: 'min-h-[100svh]', large: 'min-h-[78svh]', medium: 'min-h-[52svh] sm:min-h-[60svh]' } as Record<string, string>;
  const dark = hasImage;

  return (
    <section className={cn('relative flex items-end overflow-hidden', heights[height] ?? heights.full, overHero && '-mt-20', dark ? 'on-dark bg-secondary text-white' : 'bg-surface-alt text-ink', height === 'medium' && !hasImage && 'min-h-0 pb-16 pt-24 sm:pt-32')} aria-label={str(props.heading)}>
      {hasImage && (
        <div className="absolute inset-0" aria-hidden={images.length > 1}>
          <AnimatePresence initial={false}>
            <motion.div key={images[i]} className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 1.6, ease: 'easeInOut' }}>
              <div className={cn('h-full w-full', motionOn && 'animate-kenburns')}>
                <SmartImage src={images[i]} alt={alts[i] || str(props.heading)} priority={i === 0 && isFirst} sizes="100vw" width={2400} />
              </div>
            </motion.div>
          </AnimatePresence>
          <div className="absolute inset-0" style={{ background: `linear-gradient(180deg, rgb(0 0 0 / ${overlay * 0.55}) 0%, rgb(0 0 0 / ${overlay * 0.35}) 40%, rgb(var(--c-secondary) / ${Math.min(0.95, overlay + 0.25)}) 100%)` }} />
        </div>
      )}
      <div className={cn('container-x relative pb-16 sm:pb-24', height === 'full' ? 'pt-40' : 'pt-32', center && 'text-center')}>
        <div className={cn('max-w-4xl', center && 'mx-auto')}>
          {str(props.eyebrow) && (
            <motion.p initial={motionOn ? { opacity: 0, y: 12 } : false} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }} className="eyebrow mb-6 text-accent">
              {str(props.eyebrow)}
            </motion.p>
          )}
          <motion.h1 initial={motionOn ? { opacity: 0, y: 24 } : false} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1, delay: 0.1, ease: [0.22, 1, 0.36, 1] }} className={cn(height === 'medium' ? 'text-[2.4rem] leading-[1.05] sm:text-fs-5' : 'h-display', dark && 'text-shadow')}>
            {str(props.heading)}
          </motion.h1>
          {str(props.subheading) && (
            <motion.p initial={motionOn ? { opacity: 0, y: 20 } : false} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1, delay: 0.25 }} className={cn('mt-6 max-w-2xl text-lg leading-relaxed sm:text-xl', dark ? 'text-white/85' : 'text-ink-muted', center && 'mx-auto')}>
              {str(props.subheading)}
            </motion.p>
          )}
          <motion.div initial={motionOn ? { opacity: 0, y: 16 } : false} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, delay: 0.4 }}>
            <Ctas ctas={arr<Cta>(props.ctas)} dark={dark} className={cn('mt-10', center && 'justify-center')} />
          </motion.div>
        </div>
        {images.length > 1 && (
          <div className="mt-12 flex gap-2" role="tablist" aria-label="Background images">
            {images.map((_, n) => (
              <button key={n} role="tab" aria-selected={n === i} aria-label={`Show image ${n + 1}`} onClick={() => setI(n)} className={cn('h-1 rounded-full transition-all duration-500', n === i ? 'w-10 bg-accent' : 'w-5 bg-white/40 hover:bg-white/70')} />
            ))}
          </div>
        )}
      </div>
      {Boolean(props.showScrollHint) && height === 'full' && (
        <ChevronDown className="absolute bottom-6 left-1/2 hidden h-6 w-6 -translate-x-1/2 animate-bounce text-white/70 sm:block" aria-hidden />
      )}
    </section>
  );
}

export function ImageTextSection({ props }: SectionProps) {
  const left = props.imagePosition === 'left';
  const highlights = arr<string>(props.highlights);
  return (
    <div className="container-x grid items-center gap-12 lg:grid-cols-2 lg:gap-20">
      <Reveal className={cn('relative', left ? 'lg:order-1' : 'lg:order-2')}>
        <div className="relative aspect-[4/5] overflow-hidden rounded-theme-img sm:aspect-[5/4] lg:aspect-[4/5]">
          <SmartImage src={str(props.image)} alt={str(props.imageAlt) || str(props.heading)} sizes="(min-width:1024px) 45vw, 100vw" width={1400} />
        </div>
        {str(props.secondaryImage) && (
          <div className={cn('absolute -bottom-8 hidden aspect-square w-2/5 overflow-hidden rounded-theme-img border-8 border-bg shadow-2xl sm:block', left ? '-right-8' : '-left-8')}>
            <SmartImage src={str(props.secondaryImage)} alt="" sizes="20vw" width={700} />
          </div>
        )}
        <div className={cn('absolute -top-6 hidden h-24 w-24 rounded-full border border-accent/50 lg:block', left ? '-left-6' : '-right-6')} aria-hidden />
      </Reveal>
      <Reveal delay={0.1} className={left ? 'lg:order-2' : 'lg:order-1'}>
        {str(props.eyebrow) && <p className="eyebrow mb-4">{str(props.eyebrow)}</p>}
        <h2 className="h-section">{str(props.heading)}</h2>
        {str(props.body) && <Markdown className="mt-6 prose-p:text-ink-muted">{str(props.body)}</Markdown>}
        {highlights.length > 0 && (
          <ul className="mt-8 space-y-3">
            {highlights.map((h) => (
              <li key={h} className="flex items-start gap-3">
                <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary text-primary-contrast"><Check className="h-3.5 w-3.5" aria-hidden /></span>
                <span>{h}</span>
              </li>
            ))}
          </ul>
        )}
        <Ctas ctas={arr<Cta>(props.ctas)} className="mt-10" />
      </Reveal>
    </div>
  );
}

export function MissionVisionSection({ props }: SectionProps) {
  const values = arr<{ title: string; description: string; icon: string }>(props.values);
  return (
    <div className="container-x">
      <SectionHeader eyebrow={str(props.eyebrow)} heading={str(props.heading)} align="center" />
      <div className="grid gap-6 md:grid-cols-2">
        {[['Our mission', str(props.mission)], ['Our vision', str(props.vision)]].filter(([, t]) => t).map(([label, text], n) => (
          <Reveal key={label} delay={n * 0.1} className={cn('relative overflow-hidden rounded-theme-img p-8 sm:p-12', n === 0 ? 'bg-primary text-primary-contrast' : 'bg-secondary text-white')}>
            <Quote className="absolute -right-4 -top-4 h-32 w-32 opacity-10" aria-hidden />
            <p className="eyebrow mb-5 text-accent">{label}</p>
            <p className="font-heading text-2xl leading-snug sm:text-3xl">{text}</p>
          </Reveal>
        ))}
      </div>
      {values.length > 0 && (
        <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {values.map((v, n) => (
            <Reveal key={v.title} delay={n * 0.08} className="card p-7">
              <span className="grid h-12 w-12 place-items-center rounded-full bg-accent/15 text-primary"><Icon name={v.icon} className="h-6 w-6" /></span>
              <h3 className="mt-5 font-heading text-xl">{v.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-muted">{v.description}</p>
            </Reveal>
          ))}
        </div>
      )}
    </div>
  );
}

export function CtaSection({ props }: SectionProps) {
  const style = str(props.style, 'image');
  const image = str(props.image);
  const usesImage = style === 'image' && image;
  return (
    <div className="container-x">
      <div className={cn('on-dark relative isolate overflow-hidden rounded-theme-img px-6 py-20 text-center sm:px-16 sm:py-28', style === 'accent' ? 'bg-accent text-secondary' : 'bg-primary text-white')}>
        {usesImage && (
          <>
            <Parallax className="-z-10"><SmartImage src={image} alt="" sizes="100vw" width={2000} /></Parallax>
            <div className="absolute inset-0 -z-10 bg-gradient-to-br from-secondary/90 via-secondary/70 to-primary/60" />
          </>
        )}
        {!usesImage && <div className="bg-grain absolute inset-0 -z-10 opacity-50" aria-hidden />}
        <Reveal className="mx-auto max-w-3xl">
          {str(props.eyebrow) && <p className="eyebrow mb-5 justify-center">{str(props.eyebrow)}</p>}
          <h2 className="h-section">{str(props.heading)}</h2>
          {str(props.body) && <p className={cn('mx-auto mt-5 max-w-2xl text-lg', style === 'accent' ? 'text-secondary/80' : 'text-white/80')}>{str(props.body)}</p>}
          <Ctas ctas={arr<Cta>(props.ctas)} dark={style !== 'accent'} className="mt-10 justify-center" />
        </Reveal>
      </div>
    </div>
  );
}

export function RichTextSection({ props }: SectionProps) {
  return (
    <div className={cn('container-x', props.width === 'narrow' ? 'max-w-3xl' : '')}>
      {(str(props.eyebrow) || str(props.heading)) && <SectionHeader eyebrow={str(props.eyebrow)} heading={str(props.heading)} />}
      <Reveal>
        <Markdown>{str(props.body)}</Markdown>
      </Reveal>
    </div>
  );
}

export function IconCardsSection({ props }: SectionProps) {
  const items = arr<{ icon: string; title: string; description: string; href: string }>(props.items);
  return (
    <div className="container-x">
      <SectionHeader eyebrow={str(props.eyebrow)} heading={str(props.heading)} intro={str(props.intro)} />
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((it, n) => {
          const inner = (
            <>
              <span className="grid h-14 w-14 place-items-center rounded-2xl bg-primary text-accent transition-transform duration-500 group-hover:-rotate-6"><Icon name={it.icon} className="h-7 w-7" /></span>
              <h3 className="mt-6 font-heading text-2xl">{it.title}</h3>
              <p className="mt-2 text-ink-muted">{it.description}</p>
              {it.href && <span className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-primary">Learn more <ArrowRight className="h-4 w-4" aria-hidden /></span>}
            </>
          );
          return (
            <Reveal key={it.title} delay={n * 0.07}>
              {it.href ? <ButtonlessLink href={it.href}>{inner}</ButtonlessLink> : <div className="card group h-full p-8">{inner}</div>}
            </Reveal>
          );
        })}
      </div>
    </div>
  );
}

function ButtonlessLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <SmartLink href={href} className="card card-hover group block h-full p-8">
      {children}
    </SmartLink>
  );
}

export function StepsSection({ props }: SectionProps) {
  const items = arr<{ title: string; description: string }>(props.items);
  return (
    <div className="container-x">
      <SectionHeader eyebrow={str(props.eyebrow)} heading={str(props.heading)} intro={str(props.intro)} align="center" />
      <ol className="relative grid gap-8 md:grid-cols-2 lg:grid-cols-4">
        <div className="absolute left-0 right-0 top-7 hidden h-px bg-line lg:block" aria-hidden />
        {items.map((s, n) => (
          <Reveal as="li" key={s.title} delay={n * 0.1} className="relative">
            <span className="relative grid h-14 w-14 place-items-center rounded-full border border-line bg-bg font-heading text-xl text-primary">{String(n + 1).padStart(2, '0')}</span>
            <h3 className="mt-6 font-heading text-xl">{s.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-ink-muted">{s.description}</p>
          </Reveal>
        ))}
      </ol>
    </div>
  );
}

export function TimelineSection({ props }: SectionProps) {
  const items = arr<{ year: string; title: string; description: string }>(props.items);
  return (
    <div className="container-x max-w-4xl">
      <SectionHeader eyebrow={str(props.eyebrow)} heading={str(props.heading)} align="center" />
      <ol className="relative border-l border-line pl-8 sm:pl-12">
        {items.map((t, n) => (
          <Reveal as="li" key={`${t.year}-${n}`} delay={n * 0.05} className="relative pb-12 last:pb-0">
            <span className="absolute -left-[41px] top-1 grid h-5 w-5 place-items-center rounded-full border-4 border-bg bg-accent sm:-left-[57px]" aria-hidden />
            <p className="font-heading text-3xl text-primary">{t.year}</p>
            <h3 className="mt-1 text-lg font-semibold">{t.title}</h3>
            <p className="mt-1 text-ink-muted">{t.description}</p>
          </Reveal>
        ))}
      </ol>
    </div>
  );
}

export function VideoSection({ props }: SectionProps) {
  const [play, setPlay] = useState(false);
  const url = str(props.url);
  const yt = url.match(/(?:youtu\.be\/|v=|embed\/)([\w-]{11})/)?.[1];
  const vimeo = url.match(/vimeo\.com\/(\d+)/)?.[1];
  const embed = yt ? `https://www.youtube-nocookie.com/embed/${yt}?autoplay=1&rel=0` : vimeo ? `https://player.vimeo.com/video/${vimeo}?autoplay=1` : '';
  const poster = str(props.poster) || (yt ? `https://i.ytimg.com/vi/${yt}/maxresdefault.jpg` : '');
  return (
    <div className="container-x">
      <SectionHeader eyebrow={str(props.eyebrow)} heading={str(props.heading)} intro={str(props.intro)} align="center" />
      <Reveal className="relative mx-auto aspect-video max-w-5xl overflow-hidden rounded-theme-img bg-secondary">
        {play && embed ? (
          <iframe src={embed} title={str(props.heading) || 'Video'} allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen className="h-full w-full" />
        ) : (
          <button onClick={() => setPlay(true)} className="group absolute inset-0" aria-label={`Play video: ${str(props.heading) || 'video'}`}>
            {poster && <SmartImage src={poster} alt="" sizes="(min-width:1024px) 64rem, 100vw" />}
            <span className="absolute inset-0 bg-black/30 transition group-hover:bg-black/20" />
            <span className="absolute left-1/2 top-1/2 grid h-20 w-20 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white/95 text-primary shadow-2xl transition group-hover:scale-110">
              <svg viewBox="0 0 24 24" className="ml-1 h-8 w-8 fill-current" aria-hidden><path d="M8 5v14l11-7z" /></svg>
            </span>
          </button>
        )}
      </Reveal>
    </div>
  );
}
