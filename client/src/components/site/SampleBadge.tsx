import { FlaskConical } from 'lucide-react';
import { cn } from '@/lib/cn';

/** Marks demo/sample records so they are never mistaken for real activity. */
export function SampleBadge({ show, className }: { show?: boolean; className?: string }) {
  if (!show) return null;
  return (
    <span title="Sample content — replace before launch" className={cn('inline-flex items-center gap-1 rounded-full bg-amber-100/95 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-900', className)}>
      <FlaskConical className="h-3 w-3" aria-hidden /> Sample
    </span>
  );
}
