import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useForm, type FieldPath } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { z } from 'zod';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Check, CheckCircle2, FileText, Send, Upload, X } from 'lucide-react';
import { VOLUNTEER_INTERESTS, volunteerApplicationSchema } from '@ngo/shared';
import { useMotionEnabled } from '@/app/SiteProvider';
import { ApiError, api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { useCollection } from '@/lib/queries';
import type { Opportunity } from '@/lib/types';
import { Button, ButtonLink, Checkbox, Field, Honeypot, Input, Select, Textarea } from '@/components/ui';
import { Seo } from '@/components/site/Seo';

type FormValues = z.input<typeof volunteerApplicationSchema>;
type Name = FieldPath<FormValues>;

const STEPS: { title: string; hint: string; fields: Name[] }[] = [
  { title: 'About you', hint: 'So we know who you are and how to reach you.', fields: ['name', 'email', 'phone', 'city', 'dateOfBirth', 'occupation'] },
  { title: 'Interests & skills', hint: 'Choose the areas you care about and what you’re good at.', fields: ['interests', 'skills', 'experience'] },
  { title: 'Availability', hint: 'When and where you can help.', fields: ['availability', 'hoursPerWeek', 'preferredLocation', 'emergencyContact'] },
  { title: 'Motivation & consent', hint: 'Almost done — tell us why you’d like to join.', fields: ['motivation', 'agreeCodeOfConduct', 'consentDataProcessing'] },
];

const AVAILABILITY = [
  { value: 'WEEKDAYS', label: 'Weekdays' },
  { value: 'WEEKENDS', label: 'Weekends' },
  { value: 'FLEXIBLE', label: 'Flexible' },
  { value: 'FULL_TIME', label: 'Full-time (internship)' },
  { value: 'REMOTE_ONLY', label: 'Remote only' },
] as const;

const MAX_RESUME = 5 * 1024 * 1024;

export default function VolunteerApplyPage() {
  const [params] = useSearchParams();
  const opportunitySlug = params.get('opportunity') ?? '';
  const opps = useCollection<Opportunity>('opportunities', { limit: 50 }, Boolean(opportunitySlug));
  const opportunity = opps.data?.data.find((o) => o.slug === opportunitySlug);
  const motionOn = useMotionEnabled();

  const [step, setStep] = useState(0);
  const [skillsText, setSkillsText] = useState('');
  const [resume, setResume] = useState<File | null>(null);
  const [resumeError, setResumeError] = useState('');
  const [rootError, setRootError] = useState('');
  const [reference, setReference] = useState<string | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const first = useRef(true);

  const { register, handleSubmit, trigger, watch, setValue, setError, formState } = useForm<FormValues>({
    resolver: zodResolver(volunteerApplicationSchema),
    mode: 'onTouched',
    defaultValues: {
      name: '', email: '', phone: '', city: '', dateOfBirth: '', occupation: '', interests: [], skills: [], experience: '', availability: 'FLEXIBLE', hoursPerWeek: undefined,
      preferredLocation: '', motivation: '', opportunitySlug: opportunitySlug || undefined, emergencyContact: '',
      agreeCodeOfConduct: false as unknown as true, consentDataProcessing: false as unknown as true, website: '',
    },
  });
  const errs = formState.errors;
  const interests = watch('interests') ?? [];

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    headingRef.current?.focus();
  }, [step, reference]);

  const toggleInterest = (i: string) => {
    const next = interests.includes(i) ? interests.filter((x) => x !== i) : [...interests, i];
    setValue('interests', next, { shouldValidate: formState.submitCount > 0 || Boolean(errs.interests), shouldDirty: true });
  };
  const onSkills = (v: string) => {
    setSkillsText(v);
    setValue('skills', v.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 15), { shouldDirty: true });
  };
  const onResume = (f: File | null) => {
    setResumeError('');
    if (!f) return setResume(null);
    if (f.type !== 'application/pdf' && !f.name.toLowerCase().endsWith('.pdf')) return setResumeError('Please upload a PDF file.');
    if (f.size > MAX_RESUME) return setResumeError('The file is larger than 5 MB.');
    setResume(f);
  };

  const next = async () => {
    const ok = await trigger(STEPS[step].fields);
    if (ok) setStep((s) => Math.min(STEPS.length - 1, s + 1));
  };
  const back = () => setStep((s) => Math.max(0, s - 1));

  const goToFieldStep = (field: string) => {
    const idx = STEPS.findIndex((s) => s.fields.includes(field as Name));
    if (idx >= 0) setStep(idx);
  };

  const onSubmit = handleSubmit(
    async (values) => {
      if (resumeError) return;
      setRootError('');
      const form = new FormData();
      form.append('data', JSON.stringify(values));
      if (resume) form.append('resume', resume);
      try {
        const r = await api<{ data: { reference: string } }>('/forms/volunteer-applications', { form });
        setReference(r.data.reference);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } catch (e) {
        if (e instanceof ApiError) {
          const fe = Object.entries(e.fieldErrors);
          fe.forEach(([k, m]) => (k === 'resume' ? setResumeError(m) : setError(k as Name, { message: m })));
          if (fe.length && fe[0][0] !== 'resume') goToFieldStep(fe[0][0]);
          setRootError(e.message);
        } else setRootError('We couldn’t send your application. Please check your connection and try again.');
      }
    },
    (invalid) => {
      const firstField = Object.keys(invalid)[0];
      if (firstField) goToFieldStep(firstField);
    },
  );

  if (reference)
    return (
      <>
        <Seo title="Application received" noIndex />
        <section className="container-x section-y">
          <div className="card mx-auto max-w-xl p-8 text-center sm:p-12" role="status">
            <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-600" aria-hidden />
            <h1 ref={headingRef} tabIndex={-1} className="mt-6 font-heading text-3xl outline-none sm:text-fs-3">Thank you for applying!</h1>
            <p className="mt-3 text-ink-muted">We’ve emailed you a confirmation. Our volunteer team usually responds within a few working days.</p>
            <p className="mt-6 rounded-xl bg-surface-alt/60 p-4 text-sm">
              Your reference <strong className="mt-1 block font-mono text-lg text-ink">{reference}</strong>
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <ButtonLink href={`/volunteer/status?ref=${encodeURIComponent(reference)}`}>Check application status</ButtonLink>
              <ButtonLink href="/volunteer" variant="outline">Back to volunteering</ButtonLink>
            </div>
          </div>
        </section>
      </>
    );

  const s = STEPS[step];
  const last = step === STEPS.length - 1;

  return (
    <>
      <Seo title="Volunteer application" description="Apply to volunteer with us." />
      <section className="container-x section-y">
        <div className="mx-auto max-w-3xl">
          <p className="eyebrow">Volunteer application</p>
          <h1 className="h-section mt-4">Join our volunteer community</h1>
          {opportunitySlug && (
            <p className="mt-4 text-ink-muted">
              Applying for: <strong className="text-ink">{opportunity?.title ?? opportunitySlug}</strong>{' '}
              <Link to="/volunteer/apply" className="ml-1 text-sm text-primary underline-offset-4 hover:underline">apply as a general volunteer instead</Link>
            </p>
          )}

          <ol className="mt-10 grid grid-cols-4 gap-2" aria-label="Application progress">
            {STEPS.map((st, i) => (
              <li key={st.title} aria-current={i === step ? 'step' : undefined}>
                <div className={cn('h-1.5 rounded-full transition-colors duration-500', i <= step ? 'bg-primary' : 'bg-ink/10')} />
                <p className={cn('mt-2 hidden text-xs font-medium sm:block', i === step ? 'text-primary' : 'text-ink-muted')}>
                  {i < step && <Check className="mr-1 inline h-3 w-3" aria-hidden />}
                  {st.title}
                </p>
                <span className="sr-only">{i < step ? ' (completed)' : i === step ? ' (current)' : ''}</span>
              </li>
            ))}
          </ol>

          <form
            onSubmit={(e) => {
              if (!last) {
                e.preventDefault();
                void next();
                return;
              }
              void onSubmit(e);
            }}
            noValidate
            className="card relative mt-8 p-6 sm:p-10"
          >
            <Honeypot {...register('website')} />
            <p className="text-sm text-ink-muted">Step {step + 1} of {STEPS.length}</p>
            <h2 ref={headingRef} tabIndex={-1} className="mt-1 font-heading text-2xl outline-none sm:text-fs-2">{s.title}</h2>
            <p className="mt-1 text-sm text-ink-muted">{s.hint}</p>

            <AnimatePresence mode="wait" initial={false}>
              <motion.div key={step} initial={motionOn ? { opacity: 0, x: 16 } : false} animate={{ opacity: 1, x: 0 }} exit={motionOn ? { opacity: 0, x: -16 } : undefined} transition={{ duration: 0.25 }} className="mt-8">
                {step === 0 && (
                  <div className="grid gap-5 sm:grid-cols-2">
                    <Field label="Full name" required error={errs.name?.message}>{(id, d) => <Input id={id} aria-describedby={d} autoComplete="name" invalid={!!errs.name} {...register('name')} />}</Field>
                    <Field label="Email" required error={errs.email?.message}>{(id, d) => <Input id={id} type="email" aria-describedby={d} autoComplete="email" invalid={!!errs.email} {...register('email')} />}</Field>
                    <Field label="Phone" required error={errs.phone?.message}>{(id, d) => <Input id={id} type="tel" aria-describedby={d} autoComplete="tel" invalid={!!errs.phone} {...register('phone')} />}</Field>
                    <Field label="City" required error={errs.city?.message}>{(id, d) => <Input id={id} aria-describedby={d} autoComplete="address-level2" invalid={!!errs.city} {...register('city')} />}</Field>
                    <Field label="Date of birth" error={errs.dateOfBirth?.message} help="Optional. Some roles have age requirements.">{(id, d) => <Input id={id} type="date" aria-describedby={d} autoComplete="bday" invalid={!!errs.dateOfBirth} {...register('dateOfBirth')} />}</Field>
                    <Field label="Occupation" error={errs.occupation?.message}>{(id, d) => <Input id={id} aria-describedby={d} autoComplete="organization-title" placeholder="e.g. Student, Engineer" {...register('occupation')} />}</Field>
                  </div>
                )}

                {step === 1 && (
                  <div className="space-y-7">
                    <fieldset aria-describedby={errs.interests ? 'interests-err' : undefined}>
                      <legend className="field-label">Areas of interest <span className="text-red-700" aria-hidden>*</span></legend>
                      <div className="mt-1 flex flex-wrap gap-2">
                        {VOLUNTEER_INTERESTS.map((i) => {
                          const on = interests.includes(i);
                          return (
                            <button
                              key={i}
                              type="button"
                              aria-pressed={on}
                              onClick={() => toggleInterest(i)}
                              className={cn('inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-medium transition', on ? 'border-primary bg-primary text-primary-contrast' : 'border-line bg-surface text-ink-muted hover:border-primary/50 hover:text-ink')}
                            >
                              {on && <Check className="h-3.5 w-3.5" aria-hidden />}
                              {i}
                            </button>
                          );
                        })}
                      </div>
                      {errs.interests && <p id="interests-err" className="field-error" role="alert">{errs.interests.message}</p>}
                    </fieldset>
                    <Field label="Skills" help="Separate with commas, e.g. teaching, photography, Excel" error={errs.skills?.message}>
                      {(id, d) => <Input id={id} aria-describedby={d} value={skillsText} onChange={(e) => onSkills(e.target.value)} />}
                    </Field>
                    <Field label="Relevant experience" error={errs.experience?.message}>{(id, d) => <Textarea id={id} aria-describedby={d} rows={4} placeholder="Any previous volunteering or related work (optional)" {...register('experience')} />}</Field>
                  </div>
                )}

                {step === 2 && (
                  <div className="grid gap-5 sm:grid-cols-2">
                    <Field label="When are you available?" required error={errs.availability?.message}>
                      {(id, d) => (
                        <Select id={id} aria-describedby={d} invalid={!!errs.availability} {...register('availability')}>
                          {AVAILABILITY.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
                        </Select>
                      )}
                    </Field>
                    <Field label="Hours per week" error={errs.hoursPerWeek?.message} help="Optional, 1–60">
                      {(id, d) => <Input id={id} type="number" inputMode="numeric" min={1} max={60} aria-describedby={d} invalid={!!errs.hoursPerWeek} {...register('hoursPerWeek', { setValueAs: (v) => (v === '' || v == null || Number.isNaN(Number(v)) ? undefined : Number(v)) })} />}
                    </Field>
                    <Field label="Preferred location" error={errs.preferredLocation?.message}>{(id, d) => <Input id={id} aria-describedby={d} placeholder="City, area or ‘remote’" {...register('preferredLocation')} />}</Field>
                    <Field label="Emergency contact" error={errs.emergencyContact?.message} help="Name and phone (optional)">{(id, d) => <Input id={id} aria-describedby={d} {...register('emergencyContact')} />}</Field>
                  </div>
                )}

                {step === 3 && (
                  <div className="space-y-6">
                    <Field label="Why would you like to volunteer with us?" required error={errs.motivation?.message} help="At least 20 characters.">
                      {(id, d) => <Textarea id={id} aria-describedby={d} rows={5} invalid={!!errs.motivation} {...register('motivation')} />}
                    </Field>
                    <div>
                      <p className="field-label">Resume / CV <span className="font-normal text-ink-muted">(optional, PDF up to 5 MB)</span></p>
                      {resume ? (
                        <div className="flex items-center gap-3 rounded-xl border border-line bg-surface-alt/40 p-3 text-sm">
                          <FileText className="h-5 w-5 shrink-0 text-primary" aria-hidden />
                          <span className="min-w-0 flex-1 truncate">{resume.name}</span>
                          <span className="text-xs text-ink-muted">{(resume.size / 1024 / 1024).toFixed(1)} MB</span>
                          <button type="button" onClick={() => setResume(null)} className="rounded-full p-1.5 hover:bg-ink/5" aria-label="Remove resume"><X className="h-4 w-4" aria-hidden /></button>
                        </div>
                      ) : (
                        <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-line px-4 py-6 text-sm text-ink-muted transition focus-within:border-primary hover:border-primary/60">
                          <Upload className="h-4 w-4" aria-hidden /> Choose a PDF
                          <input type="file" accept="application/pdf,.pdf" className="sr-only" onChange={(e) => onResume(e.target.files?.[0] ?? null)} aria-describedby={resumeError ? 'resume-err' : undefined} />
                        </label>
                      )}
                      {resumeError && <p id="resume-err" className="field-error" role="alert">{resumeError}</p>}
                    </div>
                    <div className="space-y-3 rounded-xl bg-surface-alt/40 p-4">
                      <Checkbox label="I agree to follow the volunteer code of conduct, including our safeguarding policy." {...register('agreeCodeOfConduct')} />
                      {errs.agreeCodeOfConduct && <p className="field-error" role="alert">{errs.agreeCodeOfConduct.message}</p>}
                      <Checkbox label={<>I consent to my details being used to process this application, as described in the <Link to="/privacy-policy" className="text-primary underline">privacy policy</Link>.</>} {...register('consentDataProcessing')} />
                      {errs.consentDataProcessing && <p className="field-error" role="alert">{errs.consentDataProcessing.message}</p>}
                    </div>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>

            {rootError && <p className="mt-6 rounded-xl bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950/30 dark:text-red-200" role="alert">{rootError}</p>}

            <div className="mt-10 flex flex-col-reverse gap-3 border-t border-line pt-6 sm:flex-row sm:items-center sm:justify-between">
              {step > 0 ? <Button type="button" variant="outline" icon={ArrowLeft} onClick={back}>Back</Button> : <span />}
              {last ? (
                <Button type="submit" loading={formState.isSubmitting} icon={Send}>Submit application</Button>
              ) : (
                <Button type="button" onClick={next}>Continue <ArrowRight className="h-4 w-4" aria-hidden /></Button>
              )}
            </div>
          </form>
          <p className="mt-6 text-center text-sm text-ink-muted">Already applied? <Link to="/volunteer/status" className="font-semibold text-primary underline-offset-4 hover:underline">Check your application status</Link></p>
        </div>
      </section>
    </>
  );
}
