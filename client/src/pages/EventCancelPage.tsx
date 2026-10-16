import { useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { CalendarX2, CheckCircle2 } from 'lucide-react';
import { ApiError, send } from '@/lib/api';
import { Button, ButtonLink } from '@/components/ui';
import { Seo } from '@/components/site/Seo';
import { Reveal } from '@/components/site/motion';

export default function EventCancelPage() {
  const { slug = '' } = useParams();
  const [params] = useSearchParams();
  const ref = params.get('ref') ?? '';
  const token = params.get('token') ?? '';
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const valid = Boolean(ref && token);

  const cancel = async () => {
    setState('loading');
    try {
      await send('/forms/events/registrations/cancel', { reference: ref, token });
      setState('done');
    } catch (e) {
      setMessage(e instanceof ApiError && e.status === 404 ? 'We couldn’t find this registration. It may already be cancelled, or the link may be incomplete.' : e instanceof ApiError ? e.message : 'Something went wrong. Please try again.');
      setState('error');
    }
  };

  return (
    <>
      <Seo title="Cancel registration" noIndex />
      <section className="container-x section-y">
        <Reveal className="card mx-auto max-w-xl p-8 text-center sm:p-12">
          {state === 'done' ? (
            <div role="status">
              <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" aria-hidden />
              <h1 className="mt-5 font-heading text-3xl">Registration cancelled</h1>
              <p className="mt-3 text-ink-muted">Thanks for letting us know — your place has been released for someone on the waitlist. We hope to see you at another event.</p>
              <div className="mt-8 flex flex-wrap justify-center gap-3">
                <ButtonLink href="/events">Browse events</ButtonLink>
              </div>
            </div>
          ) : (
            <>
              <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-primary/10 text-primary"><CalendarX2 className="h-6 w-6" aria-hidden /></span>
              <h1 className="mt-5 font-heading text-3xl">Cancel your registration?</h1>
              {valid ? (
                <>
                  <p className="mt-3 text-ink-muted">Registration reference <strong className="font-mono text-ink">{ref}</strong>. If you can no longer attend, cancelling frees your spot for someone else.</p>
                  {state === 'error' && <p role="alert" className="mt-5 rounded-xl bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950/30 dark:text-red-200">{message}</p>}
                  <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
                    <Button variant="danger" onClick={cancel} loading={state === 'loading'}>Yes, cancel my registration</Button>
                    <ButtonLink href={`/events/${slug}`} variant="outline">Keep my place</ButtonLink>
                  </div>
                </>
              ) : (
                <>
                  <p className="mt-3 text-ink-muted">This cancellation link is incomplete. Please use the link from your confirmation email.</p>
                  <ButtonLink href={`/events/${slug}`} variant="outline" className="mt-8">Back to the event</ButtonLink>
                </>
              )}
            </>
          )}
        </Reveal>
      </section>
    </>
  );
}
