import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Check, CircleDot, MessageSquareText, Search, XCircle } from 'lucide-react';
import { ApiError, send } from '@/lib/api';
import { cn } from '@/lib/cn';
import { date, dateTime } from '@/lib/format';
import { Button, ButtonLink, Field, Input, StatusBadge } from '@/components/ui';
import { Seo } from '@/components/site/Seo';
import { Reveal } from '@/components/site/motion';

const schema = z.object({
  reference: z.string().trim().min(4, 'Enter your application reference').max(40),
  email: z.string().trim().email('Enter the email you applied with'),
});
type Values = z.infer<typeof schema>;
type Status = 'SUBMITTED' | 'UNDER_REVIEW' | 'INFO_REQUESTED' | 'APPROVED' | 'REJECTED' | 'WITHDRAWN';
interface AppStatus { reference: string; name: string; status: Status; opportunity: string; message: string; submittedAt: string; updatedAt: string }

const TIMELINE: { key: Status | 'DECISION'; label: string; text: string }[] = [
  { key: 'SUBMITTED', label: 'Application received', text: 'We have your application.' },
  { key: 'UNDER_REVIEW', label: 'Under review', text: 'Our volunteer team is reviewing your details.' },
  { key: 'DECISION', label: 'Decision', text: 'We’ll email you as soon as a decision is made.' },
];

function stageIndex(s: Status) {
  if (s === 'SUBMITTED') return 0;
  if (s === 'UNDER_REVIEW' || s === 'INFO_REQUESTED') return 1;
  return 2;
}

function decisionText(s: Status) {
  if (s === 'APPROVED') return { label: 'Approved — welcome aboard!', text: 'We’ll be in touch with next steps and onboarding.' };
  if (s === 'REJECTED') return { label: 'Not progressed', text: 'Thank you for your interest. We hope you’ll consider other ways to get involved.' };
  if (s === 'WITHDRAWN') return { label: 'Withdrawn', text: 'This application has been withdrawn.' };
  return null;
}

function Timeline({ a }: { a: AppStatus }) {
  const current = stageIndex(a.status);
  const decision = decisionText(a.status);
  const negative = a.status === 'REJECTED' || a.status === 'WITHDRAWN';
  return (
    <ol className="relative mt-8 space-y-8 border-l-2 border-line pl-8" aria-label="Application progress">
      {TIMELINE.map((step, i) => {
        const done = i < current || (i === current && i === 2);
        const active = i === current && i !== 2;
        const label = i === 2 && decision ? decision.label : i === 1 && a.status === 'INFO_REQUESTED' ? 'More information needed' : step.label;
        const text = i === 2 && decision ? decision.text : i === 1 && a.status === 'INFO_REQUESTED' ? 'Please check your email and reply with the details we asked for.' : step.text;
        return (
          <li key={step.key} className="relative" aria-current={active || (i === 2 && current === 2) ? 'step' : undefined}>
            <span
              className={cn(
                'absolute -left-[2.55rem] top-0 grid h-8 w-8 place-items-center rounded-full ring-4 ring-surface',
                done && !(i === 2 && negative) && 'bg-primary text-primary-contrast',
                done && i === 2 && negative && 'bg-ink/20 text-ink',
                active && 'bg-accent text-secondary',
                !done && !active && 'border border-line bg-surface text-ink-muted',
              )}
            >
              {done ? i === 2 && negative ? <XCircle className="h-4 w-4" aria-hidden /> : <Check className="h-4 w-4" aria-hidden /> : <CircleDot className="h-4 w-4" aria-hidden />}
            </span>
            <p className={cn('font-semibold', !done && !active && 'text-ink-muted')}>{label}</p>
            <p className="mt-0.5 text-sm text-ink-muted">{text}</p>
            {i === 0 && <p className="mt-1 text-xs text-ink-muted">{dateTime(a.submittedAt)}</p>}
          </li>
        );
      })}
    </ol>
  );
}

export default function VolunteerStatusPage() {
  const [params] = useSearchParams();
  const [result, setResult] = useState<AppStatus | null>(null);
  const { register, handleSubmit, formState, setError } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { reference: params.get('ref') ?? '', email: '' } });
  const errs = formState.errors;
  const onSubmit = handleSubmit(async (v) => {
    try {
      setResult(await send<AppStatus>('/forms/volunteer-applications/status', v));
    } catch (e) {
      setResult(null);
      setError('root', { message: e instanceof ApiError && e.status === 404 ? 'We couldn’t find an application with these details. Check the reference and email and try again.' : e instanceof ApiError ? e.message : 'Something went wrong. Please try again.' });
    }
  });

  return (
    <>
      <Seo title="Volunteer application status" noIndex />
      <section className="container-x section-y">
        <div className="mx-auto max-w-2xl">
          <p className="eyebrow">Volunteers</p>
          <h1 className="h-section mt-4">Check your application</h1>
          <p className="lead mt-4">Enter the reference from your confirmation email and the email address you applied with.</p>

          <form onSubmit={onSubmit} noValidate className="card mt-10 grid gap-5 p-6 sm:grid-cols-[1fr_1fr_auto] sm:items-end sm:p-8">
            <Field label="Reference" required error={errs.reference?.message}>{(id, d) => <Input id={id} aria-describedby={d} className="uppercase" placeholder="VOL-…" autoComplete="off" invalid={!!errs.reference} {...register('reference')} />}</Field>
            <Field label="Email" required error={errs.email?.message}>{(id, d) => <Input id={id} type="email" aria-describedby={d} autoComplete="email" invalid={!!errs.email} {...register('email')} />}</Field>
            <Button type="submit" loading={formState.isSubmitting} icon={Search}>Check</Button>
            {errs.root && <p className="field-error sm:col-span-3" role="alert">{errs.root.message}</p>}
          </form>

          {result && (
            <Reveal className="card mt-8 p-6 sm:p-8" >
              <div aria-live="polite">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm text-ink-muted">Hi {result.name.split(' ')[0]}, here’s where things stand.</p>
                    <h2 className="mt-1 font-heading text-2xl">{result.opportunity}</h2>
                    <p className="mt-1 font-mono text-sm text-ink-muted">{result.reference}</p>
                  </div>
                  <StatusBadge status={result.status} />
                </div>
                <Timeline a={result} />
                {result.message && (
                  <div className="mt-8 rounded-xl bg-primary/5 p-5">
                    <p className="flex items-center gap-2 text-sm font-semibold"><MessageSquareText className="h-4 w-4 text-primary" aria-hidden /> Message from our team</p>
                    <p className="mt-2 whitespace-pre-line text-ink-muted">{result.message}</p>
                  </div>
                )}
                <p className="mt-6 text-xs text-ink-muted">Last updated {date(result.updatedAt, 'long')}</p>
              </div>
            </Reveal>
          )}
          <div className="mt-10 text-center"><ButtonLink href="/volunteer" variant="ghost" className="text-primary">Back to volunteering</ButtonLink></div>
        </div>
      </section>
    </>
  );
}
