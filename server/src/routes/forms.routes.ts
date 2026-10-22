import { Router } from 'express';
import { z } from 'zod';
import {
  INQUIRY_TYPE_LABELS,
  eventRegistrationSchema,
  inquirySchema,
  newsletterSchema,
  volunteerApplicationSchema,
} from '@ngo/shared';
import { prisma } from '../config/db.js';
import { env } from '../config/env.js';
import { formLimiter } from '../middleware/rateLimit.js';
import { resumeUpload, sniff } from '../middleware/upload.js';
import { sendTemplate } from '../services/email.service.js';
import { alertStaff } from '../services/notification.service.js';
import { privateStorage } from '../services/storage/index.js';
import { AppError } from '../utils/AppError.js';
import { randomToken, reference, sha256 } from '../utils/crypto.js';
import { asyncHandler, clientIp, parse } from '../utils/http.js';

export const formsRouter = Router();

formsRouter.post(
  '/inquiries',
  formLimiter,
  asyncHandler(async (req, res) => {
    const input = parse(inquirySchema, req.body);
    const ipHash = sha256(`${clientIp(req)}:${env.APP_SECRET}`).slice(0, 32);
    // Simple duplicate guard: same email + subject within 10 minutes.
    const dup = await prisma.contactInquiry.findFirst({ where: { email: input.email, subject: input.subject, createdAt: { gt: new Date(Date.now() - 10 * 60_000) } } });
    if (!dup) {
      const inquiry = await prisma.contactInquiry.create({
        data: { type: input.type, name: input.name, email: input.email, phone: input.phone, organization: input.organization, subject: input.subject, message: input.message, ipHash },
      });
      await sendTemplate({ to: input.email, template: 'inquiry_received', vars: { name: input.name, subject: input.subject }, related: { type: 'ContactInquiry', id: inquiry.id } });
      await alertStaff({ permission: 'inquiries.manage', type: 'inquiry', title: `New ${INQUIRY_TYPE_LABELS[input.type].toLowerCase()} from ${input.name}`, body: input.subject, link: `/admin/inquiries/${inquiry.id}`, email: ['CORPORATE', 'CSR', 'SPONSOR'].includes(input.type) });
    }
    res.status(201).json({ data: { ok: true } });
  }),
);

formsRouter.post(
  '/newsletter',
  formLimiter,
  asyncHandler(async (req, res) => {
    const input = parse(newsletterSchema, req.body);
    const existing = await prisma.newsletterSubscriber.findUnique({ where: { email: input.email } });
    if (existing?.status === 'SUBSCRIBED') return res.status(201).json({ data: { ok: true } });
    const sub = existing
      ? await prisma.newsletterSubscriber.update({ where: { id: existing.id }, data: { status: 'SUBSCRIBED', consentAt: new Date(), unsubscribedAt: null, name: input.name || existing.name } })
      : await prisma.newsletterSubscriber.create({ data: { email: input.email, name: input.name, source: input.source ?? 'website', unsubscribeToken: randomToken(24) } });
    await sendTemplate({
      to: sub.email,
      template: 'newsletter_welcome',
      vars: { name: sub.name ? ` ${sub.name}` : '', unsubscribeUrl: `${env.PUBLIC_SITE_URL}/unsubscribe?token=${sub.unsubscribeToken}` },
      related: { type: 'NewsletterSubscriber', id: sub.id },
    });
    res.status(201).json({ data: { ok: true } });
  }),
);

formsRouter.post(
  '/newsletter/unsubscribe',
  formLimiter,
  asyncHandler(async (req, res) => {
    const { token } = parse(z.object({ token: z.string().min(10).max(100) }), req.body);
    const r = await prisma.newsletterSubscriber.updateMany({ where: { unsubscribeToken: token, status: 'SUBSCRIBED' }, data: { status: 'UNSUBSCRIBED', unsubscribedAt: new Date() } });
    // Donor marketing preference follows the newsletter choice.
    const sub = await prisma.newsletterSubscriber.findUnique({ where: { unsubscribeToken: token } });
    if (sub) await prisma.donor.updateMany({ where: { email: sub.email }, data: { marketingOptIn: false } });
    res.json({ data: { ok: true, changed: r.count > 0 } });
  }),
);

// ─── Volunteers ──────────────────────────────────────────────────────────────────

formsRouter.post(
  '/volunteer-applications',
  formLimiter,
  resumeUpload.single('resume'),
  asyncHandler(async (req, res) => {
    // Multipart: JSON payload in the "data" field.
    const raw = typeof req.body?.data === 'string' ? JSON.parse(req.body.data) : req.body;
    const input = parse(volunteerApplicationSchema, raw);
    let resumeKey: string | undefined;
    if (req.file) {
      const type = sniff(req.file.buffer);
      if (type?.mime !== 'application/pdf') throw AppError.validation('Resume must be a PDF', [{ path: 'resume', message: 'Upload a PDF (max 5 MB)' }]);
      resumeKey = await privateStorage.put(req.file.buffer, 'pdf');
    }
    let opportunityId: string | null = null;
    if (input.opportunitySlug) {
      const opp = await prisma.volunteerOpportunity.findFirst({ where: { slug: input.opportunitySlug, status: 'OPEN' } });
      if (!opp) throw AppError.badRequest('This opportunity is no longer open');
      if (opp.deadline && opp.deadline < new Date(new Date().toDateString())) throw AppError.badRequest('The application deadline has passed');
      opportunityId = opp.id;
    }
    const profileData = {
      name: input.name,
      phone: input.phone,
      city: input.city,
      dateOfBirth: input.dateOfBirth ? new Date(input.dateOfBirth) : null,
      occupation: input.occupation,
      interests: input.interests,
      skills: input.skills,
      experience: input.experience,
      availability: input.availability,
      hoursPerWeek: input.hoursPerWeek ?? null,
      preferredLocation: input.preferredLocation,
      emergencyContact: input.emergencyContact,
      ...(resumeKey ? { resumeKey } : {}),
    };
    const profile = await prisma.volunteerProfile.upsert({ where: { email: input.email }, create: { email: input.email, ...profileData }, update: profileData });
    const open = await prisma.volunteerApplication.findFirst({ where: { profileId: profile.id, opportunityId, status: { in: ['SUBMITTED', 'UNDER_REVIEW', 'INFO_REQUESTED'] } } });
    if (open) throw AppError.conflict(`You already have an application in progress (reference ${open.reference}).`);
    const application = await prisma.volunteerApplication.create({ data: { reference: reference('VOL'), profileId: profile.id, opportunityId, motivation: input.motivation } });
    await sendTemplate({
      to: profile.email,
      template: 'volunteer_received',
      vars: { name: profile.name, reference: application.reference, statusUrl: `${env.PUBLIC_SITE_URL}/volunteer/status?ref=${application.reference}` },
      related: { type: 'VolunteerApplication', id: application.id },
    });
    await alertStaff({ permission: 'volunteers.manage', type: 'volunteer', title: `New volunteer application from ${profile.name}`, link: `/admin/volunteers/applications/${application.id}` });
    res.status(201).json({ data: { reference: application.reference } });
  }),
);

/** Status lookup requires both the reference and the email used to apply. */
formsRouter.post(
  '/volunteer-applications/status',
  formLimiter,
  asyncHandler(async (req, res) => {
    const { reference: ref, email } = parse(z.object({ reference: z.string().trim().toUpperCase().max(40), email: z.string().trim().toLowerCase().email() }), req.body);
    const app = await prisma.volunteerApplication.findUnique({ where: { reference: ref }, include: { profile: { select: { email: true, name: true } }, opportunity: { select: { title: true } } } });
    if (!app || app.profile.email !== email) throw AppError.notFound('No application found with these details');
    res.json({
      data: {
        reference: app.reference,
        name: app.profile.name,
        status: app.status,
        opportunity: app.opportunity?.title ?? 'General volunteering',
        message: app.messageToApplicant,
        submittedAt: app.createdAt,
        updatedAt: app.updatedAt,
      },
    });
  }),
);

// ─── Events ──────────────────────────────────────────────────────────────────────

formsRouter.post(
  '/events/:slug/register',
  formLimiter,
  asyncHandler(async (req, res) => {
    const input = parse(eventRegistrationSchema, req.body);
    const event = await prisma.event.findFirst({ where: { slug: req.params.slug, status: 'PUBLISHED' } });
    if (!event) throw AppError.notFound('Event not found');
    if (!event.registrationOpen || (event.endsAt ?? event.startsAt) < new Date()) throw AppError.badRequest('Registration is closed for this event');
    if (input.type === 'VOLUNTEER' && !event.volunteerSlots) throw AppError.badRequest('This event is not looking for volunteers');

    const token = randomToken(24);
    // Writing the event inside the transaction makes concurrent sign-ups for the same event conflict
    // (one is rejected and can retry), so two people can't take the last seat.
    const registration = await prisma.$transaction(
      async (tx) => {
        await tx.event.update({ where: { id: event.id }, data: { updatedAt: new Date() } });
        const existing = await tx.eventRegistration.findUnique({ where: { eventId_email_type: { eventId: event.id, email: input.email, type: input.type } } });
        if (existing && existing.status !== 'CANCELLED') throw AppError.conflict('You are already registered for this event');
        let status: 'CONFIRMED' | 'WAITLISTED' = 'CONFIRMED';
        if (input.type === 'ATTENDEE' && event.capacity) {
          const agg = await tx.eventRegistration.aggregate({ where: { eventId: event.id, type: 'ATTENDEE', status: 'CONFIRMED' }, _count: true, _sum: { guests: true } });
          if (agg._count + (agg._sum.guests ?? 0) + 1 + input.guests > event.capacity) status = 'WAITLISTED';
        }
        if (input.type === 'VOLUNTEER') {
          const count = await tx.eventRegistration.count({ where: { eventId: event.id, type: 'VOLUNTEER', status: 'CONFIRMED' } });
          if (count >= (event.volunteerSlots ?? 0)) status = 'WAITLISTED';
        }
        const data = { name: input.name, phone: input.phone, guests: input.type === 'VOLUNTEER' ? 0 : input.guests, status, attended: false, checkedInAt: null, cancelToken: sha256(token) };
        return existing
          ? tx.eventRegistration.update({ where: { id: existing.id }, data })
          : tx.eventRegistration.create({ data: { ...data, reference: reference('EVT'), eventId: event.id, email: input.email, type: input.type } });
      },
    );
    await sendTemplate({
      to: registration.email,
      template: 'event_registration',
      vars: {
        name: registration.name,
        eventTitle: event.title,
        eventDate: event.startsAt.toLocaleString('en-IN', { dateStyle: 'full', timeStyle: 'short', timeZone: 'Asia/Kolkata' }),
        venue: [event.venue, event.address].filter(Boolean).join(', '),
        reference: registration.reference,
        status: registration.status === 'CONFIRMED' ? 'confirmed' : 'on the waitlist',
        cancelUrl: `${env.PUBLIC_SITE_URL}/events/${event.slug}/cancel?ref=${registration.reference}&token=${token}`,
      },
      related: { type: 'EventRegistration', id: registration.id },
    });
    res.status(201).json({ data: { reference: registration.reference, status: registration.status } });
  }),
);

formsRouter.post(
  '/events/registrations/cancel',
  formLimiter,
  asyncHandler(async (req, res) => {
    const { reference: ref, token } = parse(z.object({ reference: z.string().max(40), token: z.string().min(10).max(100) }), req.body);
    const reg = await prisma.eventRegistration.findUnique({ where: { reference: ref } });
    if (!reg || reg.cancelToken !== sha256(token)) throw AppError.notFound('Registration not found');
    await prisma.eventRegistration.update({ where: { id: reg.id }, data: { status: 'CANCELLED' } });
    // Promote the earliest waitlisted registration of the same type, if any.
    if (reg.status === 'CONFIRMED') {
      const next = await prisma.eventRegistration.findFirst({ where: { eventId: reg.eventId, type: reg.type, status: 'WAITLISTED' }, orderBy: { createdAt: 'asc' } });
      if (next) await prisma.eventRegistration.update({ where: { id: next.id }, data: { status: 'CONFIRMED' } });
    }
    res.json({ data: { ok: true } });
  }),
);
