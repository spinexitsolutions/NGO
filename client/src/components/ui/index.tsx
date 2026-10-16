import { createContext, forwardRef, useCallback, useContext, useEffect, useId, useRef, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, Info, Loader2, X, XCircle, type LucideIcon } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/lib/cn';

// ─── Button ──────────────────────────────────────────────────────────────────────

type Variant = 'primary' | 'accent' | 'outline' | 'ghost' | 'danger';
interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: 'md' | 'sm';
  loading?: boolean;
  icon?: LucideIcon;
}
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button({ variant = 'primary', size = 'md', loading, icon: Icon, className, children, disabled, ...rest }, ref) {
  return (
    <button ref={ref} className={cn('btn', `btn-${variant}`, size === 'sm' && 'btn-sm', className)} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : Icon ? <Icon className="h-4 w-4" aria-hidden /> : null}
      {children}
    </button>
  );
});

/** Internal paths use the router; external links open safely. */
export function ButtonLink({ href, variant = 'primary', size = 'md', className, children, icon: Icon }: { href: string; variant?: Variant; size?: 'md' | 'sm'; className?: string; children: ReactNode; icon?: LucideIcon }) {
  const cls = cn('btn', `btn-${variant}`, size === 'sm' && 'btn-sm', className);
  const content = (
    <>
      {children}
      {Icon && <Icon className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />}
    </>
  );
  return <SmartLink href={href} className={cn('group', cls)}>{content}</SmartLink>;
}

export function SmartLink({ href, className, children, onClick, ...rest }: { href: string; className?: string; children: ReactNode; onClick?: () => void; 'aria-label'?: string }) {
  if (/^(https?:|mailto:|tel:)/.test(href)) {
    const external = href.startsWith('http');
    return (
      <a href={href} className={className} onClick={onClick} {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})} {...rest}>
        {children}
      </a>
    );
  }
  return (
    <Link to={href || '/'} className={className} onClick={onClick} {...rest}>
      {children}
    </Link>
  );
}

// ─── Form controls ────────────────────────────────────────────────────────────

interface FieldProps {
  label?: ReactNode;
  error?: string;
  help?: ReactNode;
  required?: boolean;
  className?: string;
  children: (id: string, describedBy: string | undefined) => ReactNode;
}
export function Field({ label, error, help, required, className, children }: FieldProps) {
  const id = useId();
  const describedBy = [error ? `${id}-err` : '', help ? `${id}-help` : ''].filter(Boolean).join(' ') || undefined;
  return (
    <div className={className}>
      {label && (
        <label htmlFor={id} className="field-label">
          {label}
          {required && <span className="ml-0.5 text-red-700" aria-hidden>*</span>}
        </label>
      )}
      {children(id, describedBy)}
      {help && !error && <p id={`${id}-help`} className="field-help">{help}</p>}
      {error && (
        <p id={`${id}-err`} className="field-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }>(function Input({ className, invalid, ...rest }, ref) {
  return <input ref={ref} className={cn('input', className)} aria-invalid={invalid || undefined} {...rest} />;
});
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }>(function Textarea({ className, invalid, ...rest }, ref) {
  return <textarea ref={ref} className={cn('input min-h-[120px]', className)} aria-invalid={invalid || undefined} {...rest} />;
});
export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }>(function Select({ className, invalid, children, ...rest }, ref) {
  return (
    <select ref={ref} className={cn('input appearance-none bg-[length:16px] bg-[right_1rem_center] bg-no-repeat pr-10', className)} style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")" }} aria-invalid={invalid || undefined} {...rest}>
      {children}
    </select>
  );
});
export const Checkbox = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { label: ReactNode }>(function Checkbox({ label, className, ...rest }, ref) {
  return (
    <label className={cn('flex cursor-pointer items-start gap-3 text-sm text-ink', className)}>
      <input ref={ref} type="checkbox" className="mt-0.5 h-5 w-5 shrink-0 rounded border-line text-primary accent-[rgb(var(--c-primary))] focus:ring-primary" {...rest} />
      <span>{label}</span>
    </label>
  );
});

/** Hidden honeypot field for public forms. */
export function Honeypot(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div aria-hidden className="absolute left-[-9999px] top-auto h-px w-px overflow-hidden">
      <label>
        Leave this empty
        <input tabIndex={-1} autoComplete="off" {...props} />
      </label>
    </div>
  );
}

// ─── Feedback & states ────────────────────────────────────────────────────────

export function Spinner({ className, label = 'Loading' }: { className?: string; label?: string }) {
  return (
    <span role="status" className={cn('inline-flex items-center gap-2 text-ink-muted', className)}>
      <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
      <span className="sr-only">{label}</span>
    </span>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn('relative overflow-hidden rounded-xl bg-ink/[0.07] after:absolute after:inset-0 after:-translate-x-full after:animate-shimmer after:bg-gradient-to-r after:from-transparent after:via-white/30 after:to-transparent', className)} />;
}

export function CardGridSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true" aria-label="Loading">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="space-y-3">
          <Skeleton className="aspect-[4/3] w-full" />
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-4 w-full" />
        </div>
      ))}
    </div>
  );
}

export function EmptyState({ icon: Icon = Info, title, children, action }: { icon?: LucideIcon; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-line px-6 py-14 text-center">
      <span className="mb-4 grid h-12 w-12 place-items-center rounded-full bg-primary/10 text-primary">
        <Icon className="h-6 w-6" aria-hidden />
      </span>
      <h3 className="font-heading text-xl">{title}</h3>
      {children && <div className="mt-2 max-w-md text-sm text-ink-muted">{children}</div>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({ title = 'Something went wrong', message, onRetry }: { title?: string; message?: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center rounded-2xl border border-red-200 bg-red-50 px-6 py-10 text-center text-red-900 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">
      <AlertTriangle className="mb-3 h-7 w-7" aria-hidden />
      <p className="font-semibold">{title}</p>
      {message && <p className="mt-1 text-sm opacity-80">{message}</p>}
      {onRetry && (
        <button onClick={onRetry} className="btn btn-outline btn-sm mt-4">
          Try again
        </button>
      )}
    </div>
  );
}

const BADGE_TONES = {
  neutral: 'bg-ink/[0.07] text-ink',
  green: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200',
  amber: 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200',
  red: 'bg-red-100 text-red-900 dark:bg-red-900/40 dark:text-red-200',
  blue: 'bg-sky-100 text-sky-900 dark:bg-sky-900/40 dark:text-sky-200',
  brand: 'bg-primary/10 text-primary',
} as const;
export type BadgeTone = keyof typeof BADGE_TONES;
export function Badge({ tone = 'neutral', children, className }: { tone?: BadgeTone; children: ReactNode; className?: string }) {
  return <span className={cn('inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold', BADGE_TONES[tone], className)}>{children}</span>;
}

const STATUS_TONES: Record<string, BadgeTone> = {
  SUCCESS: 'green', PUBLISHED: 'green', ACTIVE: 'green', APPROVED: 'green', CONFIRMED: 'green', OPEN: 'green', ISSUED: 'green', RESOLVED: 'green', SUBSCRIBED: 'green', PROCESSED: 'green', COMPLETED: 'blue',
  PENDING: 'amber', DRAFT: 'neutral', SCHEDULED: 'blue', SUBMITTED: 'blue', UNDER_REVIEW: 'amber', INFO_REQUESTED: 'amber', WAITLISTED: 'amber', NEW: 'blue', IN_PROGRESS: 'amber', CREATED: 'amber', REQUESTED: 'amber', PARTIALLY_REFUNDED: 'amber', FOLLOW_UP: 'amber', APPLICANT: 'blue',
  FAILED: 'red', REJECTED: 'red', CANCELLED: 'red', VOIDED: 'red', REFUNDED: 'red', SPAM: 'red', HALTED: 'red', ARCHIVED: 'neutral', CLOSED: 'neutral', UNSUBSCRIBED: 'neutral', INACTIVE: 'neutral', EXITED: 'neutral', WITHDRAWN: 'neutral',
};
export function StatusBadge({ status }: { status: string }) {
  return <Badge tone={STATUS_TONES[status] ?? 'neutral'}>{status.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase())}</Badge>;
}

// ─── Modal & confirm ─────────────────────────────────────────────────────────

export function Modal({ open, onClose, title, children, footer, size = 'md' }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; footer?: ReactNode; size?: 'sm' | 'md' | 'lg' | 'xl' }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Tab' && ref.current) {
        const f = ref.current.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),input,select,textarea,[tabindex]:not([tabindex="-1"])');
        if (!f.length) return;
        const first = f[0];
        const last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          last.focus();
          e.preventDefault();
        } else if (!e.shiftKey && document.activeElement === last) {
          first.focus();
          e.preventDefault();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    setTimeout(() => ref.current?.querySelector<HTMLElement>('input,select,textarea,button')?.focus(), 30);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      prev?.focus();
    };
  }, [open, onClose]);
  const widths = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl', xl: 'max-w-6xl' };
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50 p-0 backdrop-blur-sm sm:items-center sm:p-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
          <motion.div
            ref={ref}
            role="dialog"
            aria-modal="true"
            aria-label={typeof title === 'string' ? title : undefined}
            className={cn('flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl bg-surface text-ink shadow-2xl sm:rounded-2xl', widths[size])}
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 20, opacity: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
          >
            <div className="flex items-center justify-between gap-4 border-b border-line px-5 py-4">
              <h2 className="font-heading text-xl">{title}</h2>
              <button onClick={onClose} className="rounded-full p-2 hover:bg-ink/5" aria-label="Close dialog">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="overflow-y-auto px-5 py-5">{children}</div>
            {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-line bg-surface-alt/40 px-5 py-3">{footer}</div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

interface ConfirmOptions {
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  danger?: boolean;
  /** When set, the user must type this text to confirm (very destructive actions). */
  typeToConfirm?: string;
}
const ConfirmContext = createContext<(o: ConfirmOptions) => Promise<boolean>>(async () => false);
export const useConfirm = () => useContext(ConfirmContext);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<(ConfirmOptions & { resolve: (v: boolean) => void }) | null>(null);
  const [typed, setTyped] = useState('');
  const confirm = useCallback((o: ConfirmOptions) => new Promise<boolean>((resolve) => { setTyped(''); setState({ ...o, resolve }); }), []);
  const close = (v: boolean) => {
    state?.resolve(v);
    setState(null);
  };
  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Modal
        open={Boolean(state)}
        onClose={() => close(false)}
        title={state?.title ?? ''}
        size="sm"
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => close(false)}>Cancel</Button>
            <Button variant={state?.danger ? 'danger' : 'primary'} size="sm" disabled={Boolean(state?.typeToConfirm && typed !== state.typeToConfirm)} onClick={() => close(true)}>
              {state?.confirmLabel ?? 'Confirm'}
            </Button>
          </>
        }
      >
        <div className="space-y-4 text-sm text-ink-muted">
          <div>{state?.message}</div>
          {state?.typeToConfirm && (
            <label className="block">
              <span className="mb-1 block text-xs">Type <strong className="text-ink">{state.typeToConfirm}</strong> to confirm</span>
              <input className="admin-input" value={typed} onChange={(e) => setTyped(e.target.value)} />
            </label>
          )}
        </div>
      </Modal>
    </ConfirmContext.Provider>
  );
}

// ─── Toasts ──────────────────────────────────────────────────────────────────

type ToastTone = 'success' | 'error' | 'info';
interface Toast { id: number; tone: ToastTone; message: string }
const ToastContext = createContext<(message: string, tone?: ToastTone) => void>(() => undefined);
export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((message: string, tone: ToastTone = 'success') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-3), { id, tone, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), tone === 'error' ? 7000 : 4000);
  }, []);
  const icons = { success: CheckCircle2, error: XCircle, info: Info };
  return (
    <ToastContext.Provider value={push}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed bottom-4 left-1/2 z-[200] flex w-[min(92vw,420px)] -translate-x-1/2 flex-col gap-2 sm:left-auto sm:right-6 sm:translate-x-0">
        <AnimatePresence>
          {toasts.map((t) => {
            const Icon = icons[t.tone];
            return (
              <motion.div key={t.id} initial={{ opacity: 0, y: 16, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8 }} className={cn('pointer-events-auto flex items-start gap-3 rounded-xl border px-4 py-3 text-sm shadow-xl', t.tone === 'error' ? 'border-red-200 bg-red-50 text-red-900' : 'border-line bg-surface text-ink')}>
                <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', t.tone === 'success' && 'text-emerald-600', t.tone === 'info' && 'text-primary')} aria-hidden />
                <span className="flex-1">{t.message}</span>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

// ─── Pagination & tabs ───────────────────────────────────────────────────────

export function Pagination({ page, pages, onChange }: { page: number; pages: number; onChange: (p: number) => void }) {
  if (pages <= 1) return null;
  return (
    <nav className="flex items-center justify-center gap-2 pt-6" aria-label="Pagination">
      <button className="btn btn-outline btn-sm" disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label="Previous page">
        <ChevronLeft className="h-4 w-4" />
      </button>
      <span className="px-3 text-sm text-ink-muted">
        Page {page} of {pages}
      </span>
      <button className="btn btn-outline btn-sm" disabled={page >= pages} onClick={() => onChange(page + 1)} aria-label="Next page">
        <ChevronRight className="h-4 w-4" />
      </button>
    </nav>
  );
}

export function Tabs<T extends string>({ tabs, value, onChange, className }: { tabs: readonly { value: T; label: ReactNode }[]; value: T; onChange: (v: T) => void; className?: string }) {
  return (
    <div role="tablist" className={cn('no-scrollbar flex gap-1 overflow-x-auto border-b border-line', className)}>
      {tabs.map((t) => (
        <button
          key={t.value}
          role="tab"
          aria-selected={t.value === value}
          onClick={() => onChange(t.value)}
          className={cn('-mb-px whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition', t.value === value ? 'border-primary text-primary' : 'border-transparent text-ink-muted hover:text-ink')}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
