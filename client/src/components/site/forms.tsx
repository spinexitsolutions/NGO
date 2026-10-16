import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CheckCircle2, Send } from 'lucide-react';
import { inquirySchema, newsletterSchema, type InquiryType } from '@ngo/shared';
import type { z } from 'zod';
import { ApiError, send } from '@/lib/api';
import { cn } from '@/lib/cn';
import { Button, Checkbox, Field, Honeypot, Input, Textarea } from '@/components/ui';

export function NewsletterForm({ dark, source = 'website', compact }: { dark?: boolean; source?: string; compact?: boolean }) {
  type F = z.input<typeof newsletterSchema>;
  const { register, handleSubmit, formState, setError } = useForm<F>({ resolver: zodResolver(newsletterSchema), defaultValues: { email: '', name: '', source, website: '' } });
  const [done, setDone] = useState(false);
  const onSubmit = handleSubmit(async (values) => {
    try {
      await send('/forms/newsletter', values);
      setDone(true);
    } catch (e) {
      setError('email', { message: e instanceof ApiError ? e.message : 'Could not subscribe. Please try again.' });
    }
  });
  if (done)
    return (
      <p role="status" className={cn('flex items-center gap-2 font-medium', dark ? 'text-white' : 'text-primary')}>
        <CheckCircle2 className="h-5 w-5" aria-hidden /> You’re subscribed. Thank you!
      </p>
    );
  return (
    <form onSubmit={onSubmit} noValidate className="relative w-full">
      <Honeypot {...register('website')} />
      <div className={cn('flex flex-col gap-3', !compact && 'sm:flex-row')}>
        <label className="sr-only" htmlFor={`nl-${source}`}>Email address</label>
        <input
          id={`nl-${source}`}
          type="email"
          autoComplete="email"
          placeholder="Your email address"
          aria-invalid={Boolean(formState.errors.email) || undefined}
          className={cn('input flex-1', dark && 'border-white/20 bg-white/10 text-white placeholder:text-white/60 focus:border-white focus:ring-white/20')}
          {...register('email')}
        />
        <Button type="submit" variant="accent" loading={formState.isSubmitting} icon={Send}>
          Subscribe
        </Button>
      </div>
      <div className="mt-3">
        <Checkbox label={<span className={dark ? 'text-white/75' : 'text-ink-muted'}>I agree to receive emails and understand I can unsubscribe anytime.</span>} {...register('consent')} />
      </div>
      {(formState.errors.email || formState.errors.consent) && (
        <p className={cn('mt-2 text-sm', dark ? 'text-amber-200' : 'text-red-700')} role="alert">
          {formState.errors.email?.message ?? formState.errors.consent?.message}
        </p>
      )}
    </form>
  );
}

export function InquiryForm({ type = 'GENERAL', submitLabel = 'Send message', successMessage = 'Thank you! We have received your message.' }: { type?: InquiryType; submitLabel?: string; successMessage?: string }) {
  type F = z.input<typeof inquirySchema>;
  const { register, handleSubmit, formState, setError, reset } = useForm<F>({ resolver: zodResolver(inquirySchema), defaultValues: { type, name: '', email: '', phone: '', organization: '', subject: '', message: '', website: '' } });
  const [done, setDone] = useState(false);
  const e = formState.errors;
  const showOrg = ['CORPORATE', 'CSR', 'SPONSOR', 'MEDIA'].includes(type);
  const onSubmit = handleSubmit(async (values) => {
    try {
      await send('/forms/inquiries', values);
      setDone(true);
      reset();
    } catch (err) {
      if (err instanceof ApiError) Object.entries(err.fieldErrors).forEach(([k, m]) => setError(k as keyof F, { message: m }));
      setError('root', { message: err instanceof ApiError ? err.message : 'Something went wrong. Please try again.' });
    }
  });
  if (done)
    return (
      <div role="status" className="card p-8 text-center">
        <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" aria-hidden />
        <p className="mt-4 font-heading text-2xl">Message sent</p>
        <p className="mt-2 text-ink-muted">{successMessage}</p>
        <button className="btn btn-ghost mt-4 text-primary" onClick={() => setDone(false)}>Send another message</button>
      </div>
    );
  return (
    <form onSubmit={onSubmit} noValidate className="card relative grid gap-5 p-6 sm:grid-cols-2 sm:p-8">
      <Honeypot {...register('website')} />
      <Field label="Your name" required error={e.name?.message}>{(id, d) => <Input id={id} aria-describedby={d} autoComplete="name" invalid={!!e.name} {...register('name')} />}</Field>
      <Field label="Email" required error={e.email?.message}>{(id, d) => <Input id={id} type="email" aria-describedby={d} autoComplete="email" invalid={!!e.email} {...register('email')} />}</Field>
      <Field label="Phone" error={e.phone?.message}>{(id, d) => <Input id={id} type="tel" aria-describedby={d} autoComplete="tel" invalid={!!e.phone} {...register('phone')} />}</Field>
      {showOrg ? (
        <Field label="Organisation" error={e.organization?.message}>{(id, d) => <Input id={id} aria-describedby={d} autoComplete="organization" {...register('organization')} />}</Field>
      ) : (
        <div className="hidden sm:block" />
      )}
      <Field label="Subject" required error={e.subject?.message} className="sm:col-span-2">{(id, d) => <Input id={id} aria-describedby={d} invalid={!!e.subject} {...register('subject')} />}</Field>
      <Field label="Message" required error={e.message?.message} className="sm:col-span-2">{(id, d) => <Textarea id={id} aria-describedby={d} rows={5} invalid={!!e.message} {...register('message')} />}</Field>
      <div className="sm:col-span-2">
        <Checkbox label="I agree that my details will be used to respond to this message, as described in the privacy policy." {...register('consent')} />
        {e.consent && <p className="field-error">{e.consent.message}</p>}
      </div>
      {e.root && <p className="field-error sm:col-span-2" role="alert">{e.root.message}</p>}
      <div className="sm:col-span-2">
        <Button type="submit" loading={formState.isSubmitting} icon={Send}>{submitLabel}</Button>
      </div>
    </form>
  );
}
