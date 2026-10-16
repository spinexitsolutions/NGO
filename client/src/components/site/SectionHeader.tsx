import type { ReactNode } from 'react';
import { ArrowRight } from 'lucide-react';
import { cn } from '@/lib/cn';
import { SmartLink } from '@/components/ui';
import { Reveal } from './motion';

export function SectionHeader({ eyebrow, heading, intro, link, align = 'left', className, dark }: { eyebrow?: string; heading?: string; intro?: ReactNode; link?: { href: string; label: string }; align?: 'left' | 'center'; className?: string; dark?: boolean }) {
  if (!eyebrow && !heading && !intro) return null;
  return (
    <Reveal className={cn('mb-12 flex flex-col gap-6 md:mb-16', align === 'center' ? 'items-center text-center' : 'md:flex-row md:items-end md:justify-between', className)}>
      <div className={cn('max-w-3xl', align === 'center' && 'mx-auto')}>
        {eyebrow && <p className="eyebrow mb-4">{eyebrow}</p>}
        {heading && <h2 className={cn('h-section', dark && 'text-white')}>{heading}</h2>}
        {intro && <p className={cn('lead mt-5', dark && 'text-white/75')}>{intro}</p>}
      </div>
      {link && link.label && (
        <SmartLink href={link.href} className={cn('group inline-flex shrink-0 items-center gap-2 font-semibold', dark ? 'text-white' : 'text-primary')}>
          {link.label}
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden />
        </SmartLink>
      )}
    </Reveal>
  );
}
