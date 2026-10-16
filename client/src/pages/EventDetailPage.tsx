import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { z } from 'zod';
import { AlertTriangle, CalendarDays, CalendarPlus, CheckCircle2, Clock, Download, ExternalLink, Heart, Hourglass, MapPin, Ticket, Users } from 'lucide-react';
import { eventRegistrationSchema } from '@ngo/shared';
import { useSite } from '@/app/SiteProvider';
import { ApiError, send } from '@/lib/api';
import { cn } from '@/lib/cn';
import { usePublic } from '@/lib/queries';
import type { EventItem } from '@/lib/types';
import { Badge, Button, ButtonLink, Field, Honeypot, Input, Select } from '@/components/ui';
import { Gallery } from '@/components/site/Lightbox';
import { Markdown } from '@/components/site/Markdown';
import { Reveal } from '@/components/site/motion';
import { Seo } from '@/components/site/Seo';
import { ShareButtons } from '@/components/site/ShareButtons';
import { Block, DetailBanner, QueryGate, pageUrl, toGallery } from './page-kit';

export default function EventDetailPage() {
  const { slug = '' } = useParams();
  const query = usePublic<EventItem>(`/public/events/${slug}`);
  return <QueryGate query={query}>{(e) => <EventView e={e} />}</QueryGate>;
}

const fmtDay = (d: string) => new Date(d).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const fmtTime = (d: string) => new Date(d).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });

/** Builds and downloads an .ics calendar file for the event. */
function downloadIcs(e: EventItem, orgName: string) {
  const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/[,;]/g, (m) => `\\${m}`);
  const start = new Date(e.startsAt);
  const end = e.endsAt ? new Date(e.endsAt) : new Date(start.getTime() + 2 * 3_600_000);
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:-//${esc(orgName)}//Events//EN`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${e.id}@${window.location.host}`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(start)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${esc(e.title)}`,
    `DESCRIPTION:${esc(`${e.summary}\n\n${pageUrl()}`)}`,
    `LOCATION:${esc([e.venue, e.address].filter(Boolean).join(', '))}`,
    `URL:${pageUrl()}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${e.slug}.ics`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

type FormValues = z.input<typeof eventRegistrationSchema>;

function RegistrationForm({ e }: { e: EventItem }) {
  const { settings } = useSite();
  const canVolunteer = (e.volunteerSpotsLeft ?? 0) > 0;
  const { register, handleSubmit, watch, formState, setError } = useForm<FormValues>({
    resolver: zodResolver(eventRegistrationSchema),
    defaultValues: { name: '', email: '', phone: '', type: 'ATTENDEE', guests: 0, website: '' },
  });
  const [result, setResult] = useState<{ reference: string; status: 'CONFIRMED' | 'WAITLISTED' } | null>(null);
  const type = watch('type');
  const errs = formState.errors;
  const full = e.spotsLeft === 0;

  const onSubmit = handleSubmit(async (values) => {
    try {
      const r = await send<{ reference: string; status: 'CONFIRMED' | 'WAITLISTED' }>(`/forms/events/${e.slug}/register`, { ...values, guests: values.type === 'VOLUNTEER' ? 0 : values.guests });
      setResult(r);
    } catch (err) {
      if (err instanceof ApiError) Object.entries(err.fieldErrors).forEach(([k, m]) => setError(k as keyof FormValues, { message: m }));
      setError('root', { message: err instanceof ApiError ? err.message : 'Something went wrong. Please try again.' });
    }
  });

  if (result)
    return (
      <div role="status" className="text-center">
        {result.status === 'CONFIRMED' ? <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" aria-hidden /> : <Hourglass className="mx-auto h-12 w-12 text-amber-600" aria-hidden />}
        <h3 className="mt-4 font-heading text-2xl">{result.status === 'CONFIRMED' ? 'You’re registered!' : 'You’re on the waitlist'}</h3>
        <p className="mt-2 text-sm text-ink-muted">
          {result.status === 'CONFIRMED' ? 'We’ve emailed your confirmation with a link to cancel if your plans change.' : 'The event is currently full. We’ll email you if a place opens up.'}
        </p>
        <p className="mt-5 rounded-xl bg-surface-alt/60 p-3 text-sm">
          Reference <strong className="font-mono text-ink">{result.reference}</strong>
        </p>
        <Button variant="outline" size="sm" icon={CalendarPlus} className="mt-5" onClick={() => downloadIcs(e, settings.organization.name)}>Add to calendar</Button>
      </div>
    );

  return (
    <form onSubmit={onSubmit} noValidate className="relative space-y-4" aria-label="Register for this event">
      <Honeypot {...register('website')} />
      {canVolunteer && (
        <fieldset>
          <legend className="field-label">I’d like to join as</legend>
          <div className="grid grid-cols-2 gap-2">
            {(['ATTENDEE', 'VOLUNTEER'] as const).map((t) => (
              <label key={t} className={cn('flex cursor-pointer items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition focus-within:ring-4 focus-within:ring-primary/15', type === t ? 'border-primary bg-primary/10 text-primary' : 'border-line text-ink-muted hover:border-primary/50')}>
                <input type="radio" value={t} className="sr-only" {...register('type')} />
                {t === 'ATTENDEE' ? <Ticket className="h-4 w-4" aria-hidden /> : <Users className="h-4 w-4" aria-hidden />}
                {t === 'ATTENDEE' ? 'Attendee' : 'Volunteer'}
              </label>
            ))}
          </div>
          {type === 'VOLUNTEER' && <p className="field-help">{e.volunteerSpotsLeft} volunteer {e.volunteerSpotsLeft === 1 ? 'spot' : 'spots'} left.</p>}
        </fieldset>
      )}
      <Field label="Full name" required error={errs.name?.message}>{(id, d) => <Input id={id} aria-describedby={d} autoComplete="name" invalid={!!errs.name} {...register('name')} />}</Field>
      <Field label="Email" required error={errs.email?.message}>{(id, d) => <Input id={id} type="email" aria-describedby={d} autoComplete="email" invalid={!!errs.email} {...register('email')} />}</Field>
      <Field label="Phone" error={errs.phone?.message} help="Optional — for day-of updates.">{(id, d) => <Input id={id} type="tel" aria-describedby={d} autoComplete="tel" invalid={!!errs.phone} {...register('phone')} />}</Field>
      {type !== 'VOLUNTEER' && (
        <Field label="Bringing guests?" error={errs.guests?.message}>
          {(id, d) => (
            <Select id={id} aria-describedby={d} {...register('guests', { valueAsNumber: true })}>
              {[0, 1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n === 0 ? 'Just me' : `Me + ${n} guest${n > 1 ? 's' : ''}`}</option>)}
            </Select>
          )}
        </Field>
      )}
      {full && type !== 'VOLUNTEER' && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-900/30 dark:text-amber-100">This event is full — register to join the waitlist.</p>}
      {errs.root && <p className="field-error" role="alert">{errs.root.message}</p>}
      <Button type="submit" loading={formState.isSubmitting} className="w-full">{full && type !== 'VOLUNTEER' ? 'Join the waitlist' : 'Register'}</Button>
      <p className="text-center text-xs text-ink-muted">We’ll only use your details for this event.</p>
    </form>
  );
}

function EventView({ e }: { e: EventItem }) {
  const { settings } = useSite();
  const cancelled = e.status === 'CANCELLED';
  const past = Boolean(e.isPast);
  const canRegister = !cancelled && !past && e.registrationOpen;
  const gallery = toGallery(e.gallery, e.title);
  const mapHref = e.mapUrl || (e.venue || e.address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([e.venue, e.address].filter(Boolean).join(', '))}` : '');
  const sameDay = e.endsAt && new Date(e.endsAt).toDateString() === new Date(e.startsAt).toDateString();
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: e.title,
    description: e.summary,
    startDate: e.startsAt,
    endDate: e.endsAt ?? undefined,
    image: e.coverImage || undefined,
    eventStatus: cancelled ? 'https://schema.org/EventCancelled' : 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    location: { '@type': 'Place', name: e.venue || undefined, address: e.address || undefined },
    organizer: { '@type': 'NGO', name: settings.organization.name },
    url: pageUrl(),
  };

  return (
    <>
      <Seo title={e.seoTitle || e.title} description={e.seoDescription || e.summary} image={e.coverImage} jsonLd={jsonLd} />
      <DetailBanner
        image={e.coverImage}
        alt={e.coverAlt}
        eyebrow={cancelled ? 'Cancelled' : past ? 'Past event' : e.isFundraiser ? 'Fundraising event' : 'Event'}
        title={e.title}
        subtitle={
          <span className="flex flex-wrap gap-x-6 gap-y-2 text-base sm:text-lg">
            <span className="inline-flex items-center gap-2"><CalendarDays className="h-5 w-5 text-accent" aria-hidden />{fmtDay(e.startsAt)}</span>
            {e.venue && <span className="inline-flex items-center gap-2"><MapPin className="h-5 w-5 text-accent" aria-hidden />{e.venue}</span>}
          </span>
        }
        isSample={e.isSample}
        back={{ href: '/events', label: 'All events' }}
      />

      <div className="container-x section-y">
        {cancelled && (
          <div role="alert" className="mb-12 flex gap-4 rounded-theme-img border border-red-200 bg-red-50 p-6 text-red-900 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-100">
            <AlertTriangle className="mt-0.5 h-6 w-6 shrink-0" aria-hidden />
            <div>
              <p className="font-heading text-xl">This event has been cancelled</p>
              <p className="mt-1 text-sm opacity-90">{e.cancellationNote || 'We’re sorry for the inconvenience. Registered guests have been notified by email.'}</p>
            </div>
          </div>
        )}

        <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-16">
          <div className="min-w-0">
            <Reveal className="card grid gap-6 p-6 sm:grid-cols-2 sm:p-8">
              <div className="flex gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary"><Clock className="h-4 w-4" aria-hidden /></span>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">When</p>
                  <p className="mt-0.5 font-medium">{fmtDay(e.startsAt)}</p>
                  <p className="text-sm text-ink-muted">
                    {fmtTime(e.startsAt)}
                    {e.endsAt && (sameDay ? ` – ${fmtTime(e.endsAt)}` : ` – ${fmtDay(e.endsAt)}, ${fmtTime(e.endsAt)}`)}
                  </p>
                  {!cancelled && !past && (
                    <button type="button" onClick={() => downloadIcs(e, settings.organization.name)} className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline">
                      <CalendarPlus className="h-4 w-4" aria-hidden /> Add to calendar
                    </button>
                  )}
                </div>
              </div>
              {(e.venue || e.address) && (
                <div className="flex gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary"><MapPin className="h-4 w-4" aria-hidden /></span>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">Where</p>
                    {e.venue && <p className="mt-0.5 font-medium">{e.venue}</p>}
                    {e.address && <p className="text-sm text-ink-muted">{e.address}</p>}
                    {mapHref && (
                      <a href={mapHref} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline">
                        Open in maps <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                      </a>
                    )}
                  </div>
                </div>
              )}
            </Reveal>

            {e.body && <Reveal className="mt-12"><Markdown>{e.body}</Markdown></Reveal>}

            {e.materials?.length > 0 && (
              <Block title="Event materials" id="event-materials" className="mt-14">
                <ul className="grid gap-3 sm:grid-cols-2">
                  {e.materials.map((m, i) => (
                    <li key={i}>
                      <a href={m.url} target="_blank" rel="noopener noreferrer" className="card card-hover flex items-center gap-3 p-4 text-sm font-medium">
                        <Download className="h-4 w-4 shrink-0 text-primary" aria-hidden /> <span className="min-w-0 flex-1 truncate">{m.label || 'Download'}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              </Block>
            )}

            {gallery.length > 0 && (
              <Block title="Gallery" id="event-gallery" className="mt-14">
                <Gallery images={gallery} columns={2} />
              </Block>
            )}

            <div className="mt-14 border-t border-line pt-8"><ShareButtons title={e.title} /></div>
          </div>

          <aside className="space-y-6 lg:sticky lg:top-28 lg:self-start" aria-label="Registration">
            <div className="card p-6 sm:p-7">
              <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-heading text-2xl">{canRegister ? 'Register' : 'Registration'}</h2>
                {canRegister && e.spotsLeft != null && (
                  <Badge tone={e.spotsLeft === 0 ? 'amber' : e.spotsLeft < 10 ? 'amber' : 'green'}>{e.spotsLeft === 0 ? 'Waitlist only' : `${e.spotsLeft} spots left`}</Badge>
                )}
              </div>
              {canRegister ? (
                <RegistrationForm e={e} />
              ) : (
                <p className="text-sm text-ink-muted">
                  {cancelled ? 'Registration is closed because this event was cancelled.' : past ? 'This event has already taken place. Thank you to everyone who joined us!' : 'Registration is not open for this event.'}
                </p>
              )}
              {!canRegister && <ButtonLink href="/events" variant="outline" size="sm" className="mt-5 w-full">See upcoming events</ButtonLink>}
            </div>
            {e.isFundraiser && !cancelled && (
              <div className="card overflow-hidden">
                <div className="bg-primary p-6 text-primary-contrast on-dark">
                  <p className="font-heading text-xl">Can’t make it?</p>
                  <p className="mt-1 text-sm text-white/80">This is a fundraising event — you can still give to the cause.</p>
                  <ButtonLink href={`/donate?event=${encodeURIComponent(e.slug)}`} variant="accent" icon={Heart} className="mt-5 w-full">Donate</ButtonLink>
                </div>
              </div>
            )}
            {e.campaign && (
              <Link to={`/campaigns/${e.campaign.slug}`} className="card card-hover block p-5 text-sm">
                <span className="block text-xs font-semibold uppercase tracking-wider text-ink-muted">Part of the campaign</span>
                <span className="mt-1 block font-heading text-lg">{e.campaign.title}</span>
              </Link>
            )}
          </aside>
        </div>
      </div>
    </>
  );
}
