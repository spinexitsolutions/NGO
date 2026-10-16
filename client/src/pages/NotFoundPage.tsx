import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Compass, HandHeart, Home, Search } from 'lucide-react';
import { ButtonLink } from '@/components/ui';
import { Seo } from '@/components/site/Seo';
import { Reveal } from '@/components/site/motion';

export default function NotFoundPage() {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (q.trim().length >= 2) navigate(`/search?q=${encodeURIComponent(q.trim())}`);
  };
  const links = [
    { href: '/', label: 'Home', text: 'Start again from the beginning', icon: Home },
    { href: '/causes', label: 'Our causes', text: 'See the work we do', icon: Compass },
    { href: '/donate', label: 'Donate', text: 'Support a family today', icon: HandHeart },
  ];
  return (
    <>
      <Seo title="Page not found" noIndex />
      <section className="container-x section-y">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="font-heading text-[6rem] leading-none text-primary/15 sm:text-[9rem]" aria-hidden>404</p>
          <p className="eyebrow mt-2 justify-center">Page not found</p>
          <h1 className="h-section mt-4">We couldn’t find that page</h1>
          <p className="lead mt-5">It may have moved, or the link may be out of date. Try searching, or head to one of these instead.</p>
          <form onSubmit={submit} role="search" className="mx-auto mt-10 flex max-w-lg flex-col gap-3 sm:flex-row">
            <label htmlFor="nf-search" className="sr-only">Search the site</label>
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" aria-hidden />
              <input id="nf-search" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search causes, stories, events…" className="input pl-11" />
            </div>
            <button type="submit" className="btn btn-primary">Search</button>
          </form>
        </Reveal>
        <div className="mx-auto mt-16 grid max-w-4xl gap-4 sm:grid-cols-3">
          {links.map(({ href, label, text, icon: I }, i) => (
            <Reveal key={href} delay={i * 0.08}>
              <Link to={href} className="card card-hover group flex h-full flex-col p-6">
                <span className="grid h-11 w-11 place-items-center rounded-full bg-primary/10 text-primary"><I className="h-5 w-5" aria-hidden /></span>
                <span className="mt-4 font-heading text-xl">{label}</span>
                <span className="mt-1 text-sm text-ink-muted">{text}</span>
                <ArrowRight className="mt-4 h-4 w-4 text-primary transition-transform group-hover:translate-x-1" aria-hidden />
              </Link>
            </Reveal>
          ))}
        </div>
        <div className="mt-12 text-center"><ButtonLink href="/" variant="ghost" className="text-primary">Back to the home page</ButtonLink></div>
      </section>
    </>
  );
}
