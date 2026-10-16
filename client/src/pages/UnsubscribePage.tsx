import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CheckCircle2, MailX } from 'lucide-react';
import { ApiError, send } from '@/lib/api';
import { Button, ButtonLink } from '@/components/ui';
import { Seo } from '@/components/site/Seo';
import { Reveal } from '@/components/site/motion';

export default function UnsubscribePage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const unsubscribe = async () => {
    setState('loading');
    try {
      await send('/forms/newsletter/unsubscribe', { token });
      setState('done');
    } catch (e) {
      setMessage(e instanceof ApiError ? e.message : 'Something went wrong. Please try again.');
      setState('error');
    }
  };

  return (
    <>
      <Seo title="Unsubscribe" noIndex />
      <section className="container-x section-y">
        <Reveal className="card mx-auto max-w-lg p-8 text-center sm:p-12">
          {state === 'done' ? (
            <div role="status">
              <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" aria-hidden />
              <h1 className="mt-5 font-heading text-3xl">You’ve been unsubscribed</h1>
              <p className="mt-3 text-ink-muted">You won’t receive our newsletter any more. Receipts and messages about your donations will still reach you.</p>
              <ButtonLink href="/" variant="outline" className="mt-8">Back to the home page</ButtonLink>
            </div>
          ) : (
            <>
              <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-primary/10 text-primary"><MailX className="h-6 w-6" aria-hidden /></span>
              <h1 className="mt-5 font-heading text-3xl">Unsubscribe from emails</h1>
              {token ? (
                <>
                  <p className="mt-3 text-ink-muted">We’re sorry to see you go. Confirm below and we’ll stop sending you our newsletter.</p>
                  {state === 'error' && <p role="alert" className="mt-5 rounded-xl bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950/30 dark:text-red-200">{message}</p>}
                  <Button className="mt-8" onClick={unsubscribe} loading={state === 'loading'}>Unsubscribe</Button>
                </>
              ) : (
                <p className="mt-3 text-ink-muted">This link is incomplete. Please use the unsubscribe link at the bottom of one of our emails.</p>
              )}
            </>
          )}
        </Reveal>
      </section>
    </>
  );
}
