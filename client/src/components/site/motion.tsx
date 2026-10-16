import { useEffect, useRef, useState, type ReactNode } from 'react';
import { animate, motion, useInView, useScroll, useTransform } from 'framer-motion';
import { useMotionEnabled } from '@/app/SiteProvider';
import { cn } from '@/lib/cn';

/** Fades/slides content in when scrolled into view. Disabled for reduced motion. */
export function Reveal({ children, delay = 0, className, as = 'div', y = 28 }: { children: ReactNode; delay?: number; className?: string; as?: 'div' | 'li' | 'section'; y?: number }) {
  const enabled = useMotionEnabled();
  const Comp = motion[as];
  if (!enabled) {
    const Plain = as;
    return <Plain className={className}>{children}</Plain>;
  }
  return (
    <Comp className={className} initial={{ opacity: 0, y }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-60px' }} transition={{ duration: 0.8, delay, ease: [0.22, 1, 0.36, 1] }}>
      {children}
    </Comp>
  );
}

/** Animated number that counts up when visible. */
export function Counter({ value, prefix = '', suffix = '', className }: { value: number; prefix?: string; suffix?: string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: '-40px' });
  const enabled = useMotionEnabled();
  const [display, setDisplay] = useState(enabled ? 0 : value);
  useEffect(() => {
    if (!inView || !enabled) return setDisplay(value);
    const controls = animate(0, value, { duration: 2.2, ease: [0.16, 1, 0.3, 1], onUpdate: (v) => setDisplay(v) });
    return () => controls.stop();
  }, [inView, value, enabled]);
  const formatted = Math.round(display).toLocaleString('en-IN');
  return (
    <span ref={ref} className={className} aria-label={`${prefix}${value.toLocaleString('en-IN')}${suffix}`}>
      {prefix}
      {formatted}
      {suffix}
    </span>
  );
}

/** Progress bar that animates to its value on first view. */
export function ProgressBar({ percent, className, tone = 'accent', label }: { percent: number; className?: string; tone?: 'accent' | 'primary' | 'white'; label?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true });
  const enabled = useMotionEnabled();
  const p = Math.max(0, Math.min(100, percent));
  const fill = { accent: 'bg-accent', primary: 'bg-primary', white: 'bg-white' }[tone];
  return (
    <div ref={ref} className={cn('h-2 w-full overflow-hidden rounded-full bg-ink/10', className)} role="progressbar" aria-valuenow={p} aria-valuemin={0} aria-valuemax={100} aria-label={label ?? 'Progress'}>
      <motion.div className={cn('h-full rounded-full', fill)} initial={{ width: enabled ? 0 : `${p}%` }} animate={{ width: inView || !enabled ? `${p}%` : 0 }} transition={{ duration: 1.6, ease: [0.22, 1, 0.36, 1], delay: 0.2 }} />
    </div>
  );
}

/** Subtle vertical parallax for background images. */
export function Parallax({ children, className, strength = 60 }: { children: ReactNode; className?: string; strength?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const enabled = useMotionEnabled();
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  const y = useTransform(scrollYProgress, [0, 1], [-strength, strength]);
  return (
    <div ref={ref} className={cn('absolute inset-0 overflow-hidden', className)}>
      <motion.div className="absolute inset-[-80px_0]" style={enabled ? { y } : undefined}>
        {children}
      </motion.div>
    </div>
  );
}
