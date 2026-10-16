import { useState } from 'react';
import { Check, Facebook, Link2, Linkedin, MessageCircle, Share2, Twitter } from 'lucide-react';

/** Social share links (no third-party scripts) plus native share and copy-link. */
export function ShareButtons({ title, url = typeof window !== 'undefined' ? window.location.href : '', utm = true }: { title: string; url?: string; utm?: boolean }) {
  const [copied, setCopied] = useState(false);
  const withUtm = (source: string) => (utm ? `${url}${url.includes('?') ? '&' : '?'}utm_source=${source}&utm_medium=social` : url);
  const enc = encodeURIComponent;
  const links = [
    { label: 'WhatsApp', icon: MessageCircle, href: `https://wa.me/?text=${enc(`${title} ${withUtm('whatsapp')}`)}` },
    { label: 'Facebook', icon: Facebook, href: `https://www.facebook.com/sharer/sharer.php?u=${enc(withUtm('facebook'))}` },
    { label: 'X', icon: Twitter, href: `https://twitter.com/intent/tweet?text=${enc(title)}&url=${enc(withUtm('x'))}` },
    { label: 'LinkedIn', icon: Linkedin, href: `https://www.linkedin.com/sharing/share-offsite/?url=${enc(withUtm('linkedin'))}` },
  ];
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(withUtm('copy'));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  };
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="mr-1 inline-flex items-center gap-1.5 text-sm font-medium text-ink-muted"><Share2 className="h-4 w-4" aria-hidden /> Share</span>
      {links.map(({ label, icon: I, href }) => (
        <a key={label} href={href} target="_blank" rel="noopener noreferrer" className="grid h-10 w-10 place-items-center rounded-full border border-line text-ink-muted transition hover:border-primary hover:text-primary" aria-label={`Share on ${label}`}>
          <I className="h-4 w-4" />
        </a>
      ))}
      <button onClick={copy} className="grid h-10 w-10 place-items-center rounded-full border border-line text-ink-muted transition hover:border-primary hover:text-primary" aria-label="Copy link">
        {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Link2 className="h-4 w-4" />}
      </button>
      {typeof navigator !== 'undefined' && 'share' in navigator && (
        <button onClick={() => navigator.share({ title, url: withUtm('native') }).catch(() => undefined)} className="btn btn-outline btn-sm sm:hidden">
          Share…
        </button>
      )}
    </div>
  );
}
