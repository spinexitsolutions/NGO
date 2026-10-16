import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, Facebook, Heart, Instagram, Linkedin, Mail, MapPin, Menu, MessageCircle, Moon, Phone, Search, Sun, Twitter, X, Youtube } from 'lucide-react';
import { useSite } from '@/app/SiteProvider';
import { cn } from '@/lib/cn';
import { SmartLink } from '@/components/ui';
import { NewsletterForm } from './forms';

// ─── Header overlay context (transparent header over a hero) ─────────────────

const OverlayContext = createContext<(v: boolean) => void>(() => undefined);
export const useHeaderOverlay = () => useContext(OverlayContext);

function Logo({ light }: { light?: boolean }) {
  const { settings } = useSite();
  const o = settings.organization;
  const src = light && o.logoLight ? o.logoLight : o.logo;
  return (
    <Link to="/" className="flex shrink-0 items-center gap-2.5" aria-label={`${o.name} — home`}>
      {src ? (
        <img src={src} alt={o.name} className="h-10 w-auto max-w-[180px] object-contain sm:h-11" />
      ) : (
        <>
          <span className={cn('grid h-10 w-10 place-items-center rounded-full', light ? 'bg-white/15 text-accent' : 'bg-primary text-accent')}>
            <Heart className="h-5 w-5 fill-current" aria-hidden />
          </span>
          <span className="font-heading text-xl leading-none tracking-tight">{o.shortName || o.name}</span>
        </>
      )}
    </Link>
  );
}

function AnnouncementBar() {
  const { settings } = useSite();
  const a = settings.announcement;
  const key = `ngo-ann-${a.text}`;
  const [hidden, setHidden] = useState(() => {
    try {
      return sessionStorage.getItem(key) === '1';
    } catch {
      return false;
    }
  });
  if (!a.enabled || !a.text || hidden) return null;
  const tone = { primary: 'bg-primary text-primary-contrast', accent: 'bg-accent text-secondary', neutral: 'bg-secondary text-white' }[a.tone];
  return (
    <div className={cn('relative z-50 px-10 py-2.5 text-center text-sm font-medium', tone)} role="region" aria-label="Announcement">
      <span>{a.text}</span>
      {a.linkLabel && a.href && (
        <SmartLink href={a.href} className="ml-2 underline underline-offset-4 hover:no-underline">
          {a.linkLabel}
        </SmartLink>
      )}
      <button
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1.5 hover:bg-black/10"
        aria-label="Dismiss announcement"
        onClick={() => {
          setHidden(true);
          try {
            sessionStorage.setItem(key, '1');
          } catch {
            /* ignore */
          }
        }}
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

function Header({ overHero }: { overHero: boolean }) {
  const { settings, navigation, theme, mode, toggleMode } = useSite();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState<number | null>(null);
  const [mobile, setMobile] = useState(false);
  const location = useLocation();
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  useEffect(() => {
    setOpen(null);
    setMobile(false);
  }, [location.pathname]);
  useEffect(() => {
    const onDoc = (e: MouseEvent) => !navRef.current?.contains(e.target as Node) && setOpen(null);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && (setOpen(null), setMobile(false));
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, []);
  useEffect(() => {
    document.body.style.overflow = mobile ? 'hidden' : '';
  }, [mobile]);

  const transparent = theme.layout.headerStyle === 'transparent' && overHero && !scrolled && !mobile;
  const iconBtn = cn('grid h-10 w-10 place-items-center rounded-full transition', transparent ? 'hover:bg-white/10' : 'hover:bg-ink/5');

  return (
    <header className={cn('sticky top-0 z-40 transition-[background,box-shadow,color] duration-500', transparent ? 'on-dark bg-transparent text-white' : 'bg-bg/90 text-ink shadow-[0_1px_0_rgb(var(--c-border))] backdrop-blur-xl')}>
      <div className="container-x flex h-20 items-center gap-6">
        <Logo light={transparent} />
        <nav ref={navRef} aria-label="Main" className="ml-auto hidden lg:block">
          <ul className="flex items-center gap-1">
            {navigation.header.map((item, i) => (
              <li key={item.label} className="relative" onMouseEnter={() => item.children.length && setOpen(i)} onMouseLeave={() => setOpen(null)}>
                {item.children.length ? (
                  <button
                    className={cn('flex items-center gap-1 rounded-full px-3.5 py-2 text-[0.95rem] font-medium transition', transparent ? 'hover:bg-white/10' : 'hover:bg-ink/5')}
                    aria-expanded={open === i}
                    aria-haspopup="true"
                    onClick={() => setOpen(open === i ? null : i)}
                  >
                    {item.label}
                    <ChevronDown className={cn('h-4 w-4 transition-transform', open === i && 'rotate-180')} aria-hidden />
                  </button>
                ) : (
                  <NavLink to={item.href} className={({ isActive }) => cn('block rounded-full px-3.5 py-2 text-[0.95rem] font-medium transition', transparent ? 'hover:bg-white/10' : 'hover:bg-ink/5', isActive && !transparent && 'text-primary')}>
                    {item.label}
                  </NavLink>
                )}
                <AnimatePresence>
                  {open === i && item.children.length > 0 && (
                    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }} transition={{ duration: 0.18 }} className="absolute left-1/2 top-full w-[min(560px,80vw)] -translate-x-1/2 pt-3">
                      <ul className="grid gap-1 rounded-2xl border border-line bg-surface p-3 text-ink shadow-2xl sm:grid-cols-2">
                        {item.children.map((c) => (
                          <li key={c.label}>
                            <SmartLink href={c.href} className="block rounded-xl p-3 transition hover:bg-surface-alt" onClick={() => setOpen(null)}>
                              <span className="block font-semibold">{c.label}</span>
                              {c.description && <span className="mt-0.5 block text-sm text-ink-muted">{c.description}</span>}
                            </SmartLink>
                          </li>
                        ))}
                      </ul>
                    </motion.div>
                  )}
                </AnimatePresence>
              </li>
            ))}
          </ul>
        </nav>
        <div className="ml-auto flex items-center gap-1 lg:ml-2">
          {settings.header.showSearch && (
            <Link to="/search" className={iconBtn} aria-label="Search">
              <Search className="h-5 w-5" />
            </Link>
          )}
          {theme.colorMode === 'user' && (
            <button onClick={toggleMode} className={iconBtn} aria-label={mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
              {mode === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>
          )}
          {settings.features.languageSwitcher && settings.languages.length > 1 && (
            <select aria-label="Language" className="hidden rounded-full border border-current/30 bg-transparent px-2 py-1.5 text-sm sm:block" defaultValue={document.documentElement.lang || settings.languages[0].code} onChange={(e) => (document.documentElement.lang = e.target.value)}>
              {settings.languages.map((l) => (
                <option key={l.code} value={l.code} className="text-ink">{l.label}</option>
              ))}
            </select>
          )}
          {settings.header.ctaLabel && (
            <SmartLink href={settings.header.ctaHref} className="btn btn-accent btn-sm ml-2 hidden sm:inline-flex">
              <Heart className="h-4 w-4 fill-current" aria-hidden /> {settings.header.ctaLabel}
            </SmartLink>
          )}
          <button className={cn(iconBtn, 'lg:hidden')} onClick={() => setMobile((m) => !m)} aria-label={mobile ? 'Close menu' : 'Open menu'} aria-expanded={mobile}>
            {mobile ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>
      <AnimatePresence>
        {mobile && (
          <motion.nav aria-label="Mobile" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'calc(100dvh - 80px)' }} exit={{ opacity: 0, height: 0 }} className="overflow-y-auto border-t border-line bg-bg lg:hidden">
            <ul className="container-x space-y-1 py-6">
              {navigation.header.map((item, i) => (
                <li key={item.label} className="border-b border-line/70 pb-1">
                  {item.children.length ? (
                    <>
                      <button className="flex w-full items-center justify-between py-3 text-left font-heading text-2xl" aria-expanded={open === i} onClick={() => setOpen(open === i ? null : i)}>
                        {item.label}
                        <ChevronDown className={cn('h-5 w-5 transition-transform', open === i && 'rotate-180')} aria-hidden />
                      </button>
                      {open === i && (
                        <ul className="mb-3 space-y-1 pl-2">
                          {item.children.map((c) => (
                            <li key={c.label}>
                              <SmartLink href={c.href} className="block rounded-lg px-3 py-2 text-ink-muted hover:bg-surface-alt hover:text-ink">{c.label}</SmartLink>
                            </li>
                          ))}
                        </ul>
                      )}
                    </>
                  ) : (
                    <SmartLink href={item.href} className="block py-3 font-heading text-2xl">{item.label}</SmartLink>
                  )}
                </li>
              ))}
            </ul>
            <div className="container-x pb-10">
              <SmartLink href={settings.header.ctaHref} className="btn btn-accent w-full">
                <Heart className="h-4 w-4 fill-current" aria-hidden /> {settings.header.ctaLabel || 'Donate'}
              </SmartLink>
            </div>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}

const SOCIAL_ICONS = { facebook: Facebook, instagram: Instagram, x: Twitter, linkedin: Linkedin, youtube: Youtube, whatsapp: MessageCircle } as const;

function Footer() {
  const { settings, navigation, theme } = useSite();
  const s = settings;
  const dark = theme.layout.footerStyle === 'dark';
  const reg = s.registration;
  return (
    <footer className={cn('relative overflow-hidden', dark ? 'on-dark bg-secondary text-white' : 'border-t border-line bg-surface-alt text-ink')}>
      {dark && <div className="bg-grain pointer-events-none absolute inset-0 opacity-60" aria-hidden />}
      {s.footer.showNewsletter && (
        <div className={cn('relative border-b', dark ? 'border-white/10' : 'border-line')}>
          <div className="container-x grid items-center gap-8 py-14 lg:grid-cols-2">
            <div>
              <h2 className="font-heading text-3xl sm:text-4xl">{s.footer.newsletterHeading}</h2>
              <p className={cn('mt-3 max-w-lg', dark ? 'text-white/70' : 'text-ink-muted')}>{s.footer.newsletterText}</p>
            </div>
            <NewsletterForm dark={dark} source="footer" />
          </div>
        </div>
      )}
      <div className="container-x relative grid gap-12 py-16 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <Logo light={dark} />
          <p className={cn('mt-5 max-w-sm text-sm leading-relaxed', dark ? 'text-white/70' : 'text-ink-muted')}>{s.footer.about}</p>
          {s.social.length > 0 && (
            <ul className="mt-6 flex gap-2" aria-label="Social media">
              {s.social.map((l) => {
                const I = SOCIAL_ICONS[l.network];
                return (
                  <li key={l.network}>
                    <a href={l.url} target="_blank" rel="noopener noreferrer" aria-label={l.network} className={cn('grid h-10 w-10 place-items-center rounded-full border transition', dark ? 'border-white/20 hover:bg-white hover:text-secondary' : 'border-line hover:border-primary hover:text-primary')}>
                      <I className="h-4 w-4" />
                    </a>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <div className="grid gap-10 sm:grid-cols-3 lg:col-span-5">
          {navigation.footer.map((col) => (
            <div key={col.title}>
              <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">{col.title}</h3>
              <ul className="mt-4 space-y-2.5 text-sm">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <SmartLink href={l.href} className={cn('transition', dark ? 'text-white/75 hover:text-white' : 'text-ink-muted hover:text-ink')}>{l.label}</SmartLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="lg:col-span-3">
          <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">Contact</h3>
          <ul className={cn('mt-4 space-y-3 text-sm', dark ? 'text-white/75' : 'text-ink-muted')}>
            {s.contact.address && (
              <li className="flex gap-2.5"><MapPin className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> <span>{s.contact.address}</span></li>
            )}
            {s.contact.phone && (
              <li><a href={`tel:${s.contact.phone.replace(/\s/g, '')}`} className="flex gap-2.5 hover:underline"><Phone className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> {s.contact.phone}</a></li>
            )}
            {s.contact.email && (
              <li><a href={`mailto:${s.contact.email}`} className="flex gap-2.5 hover:underline"><Mail className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> {s.contact.email}</a></li>
            )}
          </ul>
          {reg.verified && reg.registrationNumber && (
            <p className={cn('mt-5 text-xs', dark ? 'text-white/50' : 'text-ink-muted')}>
              {reg.registrationType} · Reg. no. {reg.registrationNumber}
            </p>
          )}
        </div>
      </div>
      <div className={cn('relative border-t', dark ? 'border-white/10' : 'border-line')}>
        <div className={cn('container-x flex flex-col gap-4 py-6 text-xs sm:flex-row sm:items-center sm:justify-between', dark ? 'text-white/55' : 'text-ink-muted')}>
          <p>{s.footer.copyright.replace('{year}', String(new Date().getFullYear()))}</p>
          <ul className="flex flex-wrap gap-x-5 gap-y-2">
            {navigation.legal.map((l) => (
              <li key={l.label}><SmartLink href={l.href} className="hover:underline">{l.label}</SmartLink></li>
            ))}
            <li><Link to="/admin" className="hover:underline">Staff login</Link></li>
          </ul>
        </div>
      </div>
    </footer>
  );
}

// ─── Cookie consent & analytics (loaded only after consent) ───────────────────

const CONSENT_KEY = 'ngo-cookie-consent';
function readConsent(): 'all' | 'essential' | null {
  try {
    const v = localStorage.getItem(CONSENT_KEY);
    return v === 'all' || v === 'essential' ? v : null;
  } catch {
    return 'essential';
  }
}

function loadAnalytics(gaId: string, plausible: string) {
  if (gaId && !document.getElementById('ga-script')) {
    const s = document.createElement('script');
    s.id = 'ga-script';
    s.async = true;
    s.src = `https://www.googletagmanager.com/gtag/js?id=${gaId}`;
    document.head.appendChild(s);
    const w = window as unknown as { dataLayer: unknown[]; gtag: (...a: unknown[]) => void };
    w.dataLayer = w.dataLayer || [];
    w.gtag = function gtag() {
      // eslint-disable-next-line prefer-rest-params
      w.dataLayer.push(arguments);
    };
    w.gtag('js', new Date());
    w.gtag('config', gaId, { anonymize_ip: true });
  }
  if (plausible && !document.getElementById('plausible-script')) {
    const s = document.createElement('script');
    s.id = 'plausible-script';
    s.defer = true;
    s.dataset.domain = plausible;
    s.src = 'https://plausible.io/js/script.js';
    document.head.appendChild(s);
  }
}

function CookieConsent() {
  const { settings, isPreview } = useSite();
  const [consent, setConsent] = useState(readConsent);
  const a = settings.analytics;
  const hasAnalytics = Boolean(a.googleAnalyticsId || a.plausibleDomain);
  useEffect(() => {
    if (consent === 'all' && !isPreview) loadAnalytics(a.googleAnalyticsId, a.plausibleDomain);
  }, [consent, a.googleAnalyticsId, a.plausibleDomain, isPreview]);
  if (!settings.cookieConsent.enabled || consent || !hasAnalytics) return null;
  const choose = (v: 'all' | 'essential') => {
    try {
      localStorage.setItem(CONSENT_KEY, v);
    } catch {
      /* ignore */
    }
    setConsent(v);
  };
  return (
    <div role="dialog" aria-label="Cookie preferences" className="fixed inset-x-3 bottom-3 z-[60] mx-auto max-w-2xl rounded-2xl border border-line bg-surface p-5 text-ink shadow-2xl sm:inset-x-6 sm:bottom-6">
      <p className="text-sm text-ink-muted">
        {settings.cookieConsent.text}{' '}
        <SmartLink href={settings.cookieConsent.policyHref} className="font-medium text-primary underline underline-offset-4">Privacy policy</SmartLink>
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button className="btn btn-primary btn-sm" onClick={() => choose('all')}>Accept analytics</button>
        <button className="btn btn-outline btn-sm" onClick={() => choose('essential')}>Essential only</button>
      </div>
    </div>
  );
}

function WhatsAppButton() {
  const { settings } = useSite();
  const n = settings.contact.whatsapp.replace(/\D/g, '');
  if (!settings.features.whatsappButton || !n) return null;
  return (
    <a
      href={`https://wa.me/${n}?text=${encodeURIComponent(`Hello ${settings.organization.name}, I have a question.`)}`}
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-5 right-5 z-50 grid h-14 w-14 place-items-center rounded-full bg-[#25D366] text-white shadow-xl transition hover:scale-105"
      aria-label="Chat with us on WhatsApp"
    >
      <MessageCircle className="h-7 w-7" />
    </a>
  );
}

export function PublicLayout({ children }: { children?: ReactNode }) {
  const [overHero, setOverHero] = useState(false);
  const { pathname } = useLocation();
  useEffect(() => window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior }), [pathname]);
  return (
    <OverlayContext.Provider value={setOverHero}>
      <a href="#main" className="sr-only z-[300] rounded-lg bg-primary px-4 py-2 text-primary-contrast focus:not-sr-only focus:fixed focus:left-4 focus:top-4">Skip to content</a>
      <AnnouncementBar />
      <Header overHero={overHero} />
      <main id="main" tabIndex={-1} className="min-h-[60vh] outline-none">
        {children ?? <Outlet />}
      </main>
      <Footer />
      <CookieConsent />
      <WhatsAppButton />
    </OverlayContext.Provider>
  );
}
