import { Router } from 'express';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../../config/db.js';
import { env } from '../../config/env.js';
import { hasPermission, requireAuth, requirePermission } from '../../middleware/auth.js';
import { audit } from '../../services/audit.service.js';
import { sendTemplate, previewTemplate } from '../../services/email.service.js';
import { DEFAULT_EMAIL_TEMPLATES } from '../../services/emailTemplates.js';
import { AppError } from '../../utils/AppError.js';
import { reference } from '../../utils/crypto.js';
import { toCsv } from '../../utils/csv.js';
import { asyncHandler, pageMeta, parse } from '../../utils/http.js';

// ─── Event registrations & attendance ───────────────────────────────────────────

export const adminEventsRouter = Router();
adminEventsRouter.use(requirePermission('events.manage'));

adminEventsRouter.get(
  '/:eventId/registrations',
  asyncHandler(async (req, res) => {
    const event = await prisma.event.findUniqueOrThrow({ where: { id: req.params.eventId } });
    const rows = await prisma.eventRegistration.findMany({ where: { eventId: event.id }, orderBy: { createdAt: 'asc' }, omit: { cancelToken: true } });
    if (req.query.format === 'csv') {
      await audit(req, { action: 'event_registrations.exported', entityType: 'Event', entityId: event.id });
      res.type('text/csv').attachment(`${event.slug}-registrations.csv`);
      return res.send(toCsv(rows, ['reference', 'name', 'email', 'phone', 'type', 'guests', 'status', 'attended', 'checkedInAt', 'createdAt'].map((k) => ({ key: k, label: k }))));
    }
    const stats = {
      confirmed: rows.filter((r) => r.status === 'CONFIRMED' && r.type === 'ATTENDEE').reduce((n, r) => n + 1 + r.guests, 0),
      waitlisted: rows.filter((r) => r.status === 'WAITLISTED').length,
      volunteers: rows.filter((r) => r.status === 'CONFIRMED' && r.type === 'VOLUNTEER').length,
      attended: rows.filter((r) => r.attended).length,
      capacity: event.capacity,
    };
    res.json({ data: rows, meta: { event: { id: event.id, title: event.title, startsAt: event.startsAt, status: event.status, slug: event.slug }, stats } });
  }),
);

adminEventsRouter.post(
  '/:eventId/registrations',
  asyncHandler(async (req, res) => {
    // Walk-in / staff-added registration.
    const b = parse(z.object({ name: z.string().trim().min(2).max(100), email: z.string().trim().toLowerCase().email(), phone: z.string().max(20).default(''), type: z.enum(['ATTENDEE', 'VOLUNTEER']).default('ATTENDEE'), attended: z.boolean().default(false) }), req.body);
    const reg = await prisma.eventRegistration.create({
      data: { ...b, eventId: req.params.eventId, reference: reference('EVT'), cancelToken: reference('X'), checkedInAt: b.attended ? new Date() : null },
      omit: { cancelToken: true },
    });
    await audit(req, { action: 'event_registration.added', entityType: 'EventRegistration', entityId: reg.id, summary: b.email });
    res.status(201).json({ data: reg });
  }),
);

adminEventsRouter.put(
  '/registrations/:id',
  asyncHandler(async (req, res) => {
    const b = parse(z.object({ status: z.enum(['CONFIRMED', 'WAITLISTED', 'CANCELLED']), attended: z.boolean() }), req.body);
    const before = await prisma.eventRegistration.findUniqueOrThrow({ where: { id: req.params.id } });
    const reg = await prisma.eventRegistration.update({
      where: { id: before.id },
      data: { ...b, checkedInAt: b.attended ? (before.checkedInAt ?? new Date()) : null },
      omit: { cancelToken: true },
    });
    await audit(req, { action: 'event_registration.updated', entityType: 'EventRegistration', entityId: reg.id, before: { status: before.status, attended: before.attended }, after: b });
    res.json({ data: reg });
  }),
);

/** Cancels an event and notifies everyone registered. */
adminEventsRouter.post(
  '/:eventId/cancel',
  asyncHandler(async (req, res) => {
    const { note } = parse(z.object({ note: z.string().trim().max(400).default(''), confirm: z.literal(true) }), req.body);
    const event = await prisma.event.update({ where: { id: req.params.eventId }, data: { status: 'CANCELLED', cancellationNote: note, registrationOpen: false } });
    const regs = await prisma.eventRegistration.findMany({ where: { eventId: event.id, status: { in: ['CONFIRMED', 'WAITLISTED'] } } });
    for (const r of regs) {
      await sendTemplate({ to: r.email, template: 'event_cancelled', vars: { name: r.name, eventTitle: event.title, note }, related: { type: 'EventRegistration', id: r.id } });
    }
    await audit(req, { action: 'event.cancelled', entityType: 'Event', entityId: event.id, summary: `${regs.length} notified` });
    res.json({ data: { notified: regs.length } });
  }),
);

// ─── Beneficiaries (sensitive) ────────────────────────────────────────────────────

export const adminBeneficiariesRouter = Router();
const benView = requirePermission('beneficiaries.view', 'beneficiaries.manage');
const benManage = requirePermission('beneficiaries.manage');

const beneficiarySchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  gender: z.enum(['', 'FEMALE', 'MALE', 'OTHER', 'UNDISCLOSED']).default(''),
  dateOfBirth: z.string().date().nullable().default(null),
  guardianName: z.string().max(120).default(''),
  phone: z.string().max(20).default(''),
  address: z.string().max(400).default(''),
  village: z.string().max(120).default(''),
  district: z.string().max(120).default(''),
  projectId: z.string().nullable().default(null),
  programs: z.array(z.string().max(80)).max(10).default([]),
  status: z.enum(['ACTIVE', 'FOLLOW_UP', 'EXITED']).default('ACTIVE'),
  consentPublic: z.boolean().default(false),
});

function isMinor(dob: string | null) {
  if (!dob) return false;
  return Date.now() - new Date(dob).getTime() < 18 * 365.25 * 86_400_000;
}

adminBeneficiariesRouter.get(
  '/',
  benView,
  asyncHandler(async (req, res) => {
    const q = parse(
      z.object({ page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(100).default(25), q: z.string().max(120).optional(), projectId: z.string().optional(), status: z.string().optional(), format: z.enum(['json', 'csv']).default('json') }),
      req.query,
    );
    const where: Prisma.BeneficiaryWhereInput = {};
    if (q.projectId) where.projectId = q.projectId;
    if (q.status) where.status = q.status;
    if (q.q) where.OR = [{ code: { contains: q.q } }, { fullName: { contains: q.q } }, { village: { contains: q.q } }];
    if (q.format === 'csv') {
      if (!hasPermission(req.user, 'beneficiaries.manage')) throw AppError.forbidden();
      const rows = await prisma.beneficiary.findMany({ where, include: { project: { select: { title: true } }, _count: { select: { assistance: true } } }, orderBy: { code: 'asc' } });
      await audit(req, { action: 'beneficiaries.exported', entityType: 'Beneficiary', summary: `${rows.length} rows` });
      res.type('text/csv').attachment('beneficiaries.csv');
      // Export excludes contact details and addresses by default (data minimisation).
      return res.send(
        toCsv(
          rows.map((r) => ({ code: r.code, gender: r.gender, isMinor: r.isMinor, village: r.village, district: r.district, project: r.project?.title ?? '', programs: r.programs, status: r.status, assistanceRecords: r._count.assistance, createdAt: r.createdAt })),
          ['code', 'gender', 'isMinor', 'village', 'district', 'project', 'programs', 'status', 'assistanceRecords', 'createdAt'].map((k) => ({ key: k, label: k })),
        ),
      );
    }
    const [data, total] = await Promise.all([
      prisma.beneficiary.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
        select: { id: true, code: true, fullName: true, gender: true, isMinor: true, village: true, district: true, status: true, programs: true, project: { select: { title: true } }, createdAt: true },
      }),
      prisma.beneficiary.count({ where }),
    ]);
    res.json({ data, meta: pageMeta(q.page, q.limit, total) });
  }),
);

adminBeneficiariesRouter.get(
  '/summary',
  benView,
  asyncHandler(async (req, res) => {
    const { from, to } = parse(z.object({ from: z.string().date().optional(), to: z.string().date().optional() }), req.query);
    const range = from || to ? { distributedAt: { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}) } } : {};
    const [byType, byDistrict, totals, people] = await Promise.all([
      prisma.assistanceRecord.groupBy({ by: ['type', 'unit'], where: range, _sum: { quantity: true, valueAmount: true }, _count: true, orderBy: { _count: { type: 'desc' } } }),
      prisma.beneficiary.groupBy({ by: ['district'], _count: true }),
      prisma.beneficiary.groupBy({ by: ['status'], _count: true }),
      prisma.assistanceRecord.findMany({ where: range, distinct: ['beneficiaryId'], select: { beneficiaryId: true } }),
    ]);
    res.json({ data: { byType, byDistrict, byStatus: totals, uniqueBeneficiariesServed: people.length } });
  }),
);

adminBeneficiariesRouter.get(
  '/:id',
  benView,
  asyncHandler(async (req, res) => {
    const b = await prisma.beneficiary.findUnique({
      where: { id: req.params.id },
      include: { project: { select: { id: true, title: true } }, assistance: { orderBy: { distributedAt: 'desc' } }, caseNotes: { orderBy: { createdAt: 'desc' } } },
    });
    if (!b) throw AppError.notFound();
    await audit(req, { action: 'beneficiary.viewed', entityType: 'Beneficiary', entityId: b.id });
    res.json({ data: b });
  }),
);

adminBeneficiariesRouter.post(
  '/',
  benManage,
  asyncHandler(async (req, res) => {
    const b = parse(beneficiarySchema, req.body);
    const created = await prisma.$transaction(async (tx) => {
      const c = await tx.counter.upsert({ where: { key: 'beneficiary' }, create: { key: 'beneficiary', value: 1 }, update: { value: { increment: 1 } } });
      return tx.beneficiary.create({
        data: { ...b, code: `BEN-${String(c.value).padStart(6, '0')}`, dateOfBirth: b.dateOfBirth ? new Date(b.dateOfBirth) : null, isMinor: isMinor(b.dateOfBirth), createdById: req.user!.id },
      });
    });
    await audit(req, { action: 'beneficiary.created', entityType: 'Beneficiary', entityId: created.id, summary: created.code });
    res.status(201).json({ data: created });
  }),
);

adminBeneficiariesRouter.put(
  '/:id',
  benManage,
  asyncHandler(async (req, res) => {
    const b = parse(beneficiarySchema, req.body);
    const before = await prisma.beneficiary.findUniqueOrThrow({ where: { id: req.params.id } });
    const updated = await prisma.beneficiary.update({ where: { id: before.id }, data: { ...b, dateOfBirth: b.dateOfBirth ? new Date(b.dateOfBirth) : null, isMinor: isMinor(b.dateOfBirth) } });
    await audit(req, { action: 'beneficiary.updated', entityType: 'Beneficiary', entityId: updated.id, summary: updated.code, before, after: updated });
    res.json({ data: updated });
  }),
);

adminBeneficiariesRouter.post(
  '/:id/assistance',
  benManage,
  asyncHandler(async (req, res) => {
    const b = parse(
      z.object({
        type: z.string().trim().min(2).max(80),
        description: z.string().max(400).default(''),
        quantity: z.number().positive().max(100000).default(1),
        unit: z.string().max(30).default('unit'),
        valueAmount: z.number().int().min(0).nullable().default(null),
        distributedAt: z.string().date(),
        projectId: z.string().nullable().default(null),
      }),
      req.body,
    );
    const rec = await prisma.assistanceRecord.create({ data: { ...b, beneficiaryId: req.params.id, distributedAt: new Date(b.distributedAt), recordedById: req.user!.id } });
    await audit(req, { action: 'assistance.recorded', entityType: 'AssistanceRecord', entityId: rec.id, summary: `${b.quantity} ${b.unit} ${b.type}` });
    res.status(201).json({ data: rec });
  }),
);

adminBeneficiariesRouter.post(
  '/:id/notes',
  benManage,
  asyncHandler(async (req, res) => {
    const b = parse(z.object({ note: z.string().trim().min(2).max(2000), followUpAt: z.string().date().nullable().default(null) }), req.body);
    const n = await prisma.caseNote.create({ data: { beneficiaryId: req.params.id, note: b.note, followUpAt: b.followUpAt ? new Date(b.followUpAt) : null, authorId: req.user!.id } });
    res.status(201).json({ data: n });
  }),
);

// ─── Inquiries, subscribers, internal notes ─────────────────────────────────────

export const adminInquiriesRouter = Router();
adminInquiriesRouter.use(requirePermission('inquiries.manage'));

adminInquiriesRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const q = parse(z.object({ page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(100).default(25), status: z.enum(['NEW', 'IN_PROGRESS', 'RESOLVED', 'SPAM']).optional(), type: z.string().max(30).optional(), q: z.string().max(200).optional() }), req.query);
    const where: Prisma.ContactInquiryWhereInput = {};
    if (q.status) where.status = q.status;
    if (q.type) where.type = q.type;
    if (q.q) where.OR = [{ name: { contains: q.q } }, { email: { contains: q.q } }, { subject: { contains: q.q } }, { organization: { contains: q.q } }];
    const [data, total, counts] = await Promise.all([
      prisma.contactInquiry.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (q.page - 1) * q.limit, take: q.limit, omit: { ipHash: true } }),
      prisma.contactInquiry.count({ where }),
      prisma.contactInquiry.groupBy({ by: ['status'], _count: true }),
    ]);
    res.json({ data, meta: { ...pageMeta(q.page, q.limit, total), counts: Object.fromEntries(counts.map((c) => [c.status, c._count])) } });
  }),
);

adminInquiriesRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const i = await prisma.contactInquiry.findUnique({ where: { id: req.params.id }, omit: { ipHash: true } });
    if (!i) throw AppError.notFound();
    const notes = await prisma.internalNote.findMany({ where: { entityType: 'ContactInquiry', entityId: i.id }, include: { author: { select: { name: true } } }, orderBy: { createdAt: 'desc' } });
    res.json({ data: { ...i, notes } });
  }),
);

adminInquiriesRouter.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const b = parse(z.object({ status: z.enum(['NEW', 'IN_PROGRESS', 'RESOLVED', 'SPAM']), assignedToId: z.string().nullable().default(null) }), req.body);
    const i = await prisma.contactInquiry.update({ where: { id: req.params.id }, data: b, omit: { ipHash: true } });
    await audit(req, { action: 'inquiry.updated', entityType: 'ContactInquiry', entityId: i.id, after: b });
    res.json({ data: i });
  }),
);

adminInquiriesRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    parse(z.object({ confirm: z.literal(true) }), req.body ?? {});
    await prisma.contactInquiry.delete({ where: { id: req.params.id } });
    await audit(req, { action: 'inquiry.deleted', entityType: 'ContactInquiry', entityId: req.params.id });
    res.json({ data: { ok: true } });
  }),
);

export const adminSubscribersRouter = Router();
adminSubscribersRouter.use(requirePermission('inquiries.manage'));
adminSubscribersRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const q = parse(z.object({ page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(100).default(50), status: z.enum(['SUBSCRIBED', 'UNSUBSCRIBED']).optional(), q: z.string().max(200).optional(), format: z.enum(['json', 'csv']).default('json') }), req.query);
    const where: Prisma.NewsletterSubscriberWhereInput = {};
    if (q.status) where.status = q.status;
    if (q.q) where.email = { contains: q.q };
    if (q.format === 'csv') {
      const rows = await prisma.newsletterSubscriber.findMany({ where, orderBy: { createdAt: 'desc' }, omit: { unsubscribeToken: true } });
      await audit(req, { action: 'subscribers.exported', entityType: 'NewsletterSubscriber', summary: `${rows.length} rows` });
      res.type('text/csv').attachment('subscribers.csv');
      return res.send(toCsv(rows, ['email', 'name', 'status', 'source', 'consentAt', 'unsubscribedAt'].map((k) => ({ key: k, label: k }))));
    }
    const [data, total] = await Promise.all([
      prisma.newsletterSubscriber.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (q.page - 1) * q.limit, take: q.limit, omit: { unsubscribeToken: true } }),
      prisma.newsletterSubscriber.count({ where }),
    ]);
    res.json({ data, meta: pageMeta(q.page, q.limit, total) });
  }),
);
adminSubscribersRouter.post(
  '/:id/unsubscribe',
  asyncHandler(async (req, res) => {
    const s = await prisma.newsletterSubscriber.update({ where: { id: req.params.id }, data: { status: 'UNSUBSCRIBED', unsubscribedAt: new Date() }, omit: { unsubscribeToken: true } });
    await audit(req, { action: 'subscriber.unsubscribed', entityType: 'NewsletterSubscriber', entityId: s.id });
    res.json({ data: s });
  }),
);

const NOTE_PERMISSION: Record<string, Parameters<typeof hasPermission>[1]> = {
  Donation: 'donations.view',
  Donor: 'donations.view',
  VolunteerApplication: 'volunteers.view',
  ContactInquiry: 'inquiries.manage',
};
export const notesRouter = Router();
notesRouter.use(requireAuth);
notesRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const b = parse(z.object({ entityType: z.enum(['Donation', 'Donor', 'VolunteerApplication', 'ContactInquiry']), entityId: z.string().min(1), body: z.string().trim().min(1).max(2000) }), req.body);
    if (!hasPermission(req.user, NOTE_PERMISSION[b.entityType])) throw AppError.forbidden();
    const note = await prisma.internalNote.create({ data: { ...b, authorId: req.user!.id }, include: { author: { select: { name: true } } } });
    res.status(201).json({ data: note });
  }),
);

// ─── Email templates & announcements ────────────────────────────────────────────

export const emailRouter = Router();
emailRouter.use(requirePermission('email.templates'));

emailRouter.get(
  '/templates',
  asyncHandler(async (_req, res) => {
    const stored = await prisma.emailTemplate.findMany();
    const map = new Map(stored.map((t) => [t.key, t]));
    res.json({ data: DEFAULT_EMAIL_TEMPLATES.map((d) => ({ ...d, ...(map.get(d.key) ?? {}), isCustomised: map.has(d.key) })) });
  }),
);

emailRouter.put(
  '/templates/:key',
  asyncHandler(async (req, res) => {
    const def = DEFAULT_EMAIL_TEMPLATES.find((t) => t.key === req.params.key);
    if (!def) throw AppError.notFound();
    const b = parse(z.object({ subject: z.string().trim().min(3).max(200), body: z.string().trim().min(10).max(10000) }), req.body);
    // Only known variables may be used.
    const used = [...`${b.subject} ${b.body}`.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((m) => m[1]);
    const unknown = used.filter((v) => v !== 'orgName' && !def.variables.includes(v));
    if (unknown.length) throw AppError.validation('Unknown variables', [{ path: 'body', message: `Not available in this template: ${[...new Set(unknown)].join(', ')}` }]);
    const t = await prisma.emailTemplate.upsert({
      where: { key: def.key },
      create: { key: def.key, name: def.name, description: def.description, variables: def.variables, isMarketing: def.isMarketing ?? false, ...b, updatedById: req.user!.id },
      update: { ...b, updatedById: req.user!.id },
    });
    await audit(req, { action: 'email_template.updated', entityType: 'EmailTemplate', entityId: def.key });
    res.json({ data: t });
  }),
);

emailRouter.post(
  '/templates/:key/reset',
  asyncHandler(async (req, res) => {
    await prisma.emailTemplate.deleteMany({ where: { key: req.params.key } });
    await audit(req, { action: 'email_template.reset', entityType: 'EmailTemplate', entityId: req.params.key });
    res.json({ data: { ok: true } });
  }),
);

emailRouter.post(
  '/templates/:key/preview',
  asyncHandler(async (req, res) => {
    const def = DEFAULT_EMAIL_TEMPLATES.find((t) => t.key === req.params.key);
    if (!def) throw AppError.notFound();
    const b = parse(z.object({ subject: z.string().max(200), body: z.string().max(10000) }), req.body);
    const sample = Object.fromEntries(def.variables.map((v) => [v, `[${v}]`]));
    res.json({ data: await previewTemplate(def.key, b.subject, b.body, sample) });
  }),
);

emailRouter.post(
  '/templates/:key/test',
  asyncHandler(async (req, res) => {
    const def = DEFAULT_EMAIL_TEMPLATES.find((t) => t.key === req.params.key);
    if (!def) throw AppError.notFound();
    const ok = await sendTemplate({ to: req.user!.email, template: def.key, vars: Object.fromEntries(def.variables.map((v) => [v, `[${v}]`])) });
    res.json({ data: { ok } });
  }),
);

emailRouter.get(
  '/log',
  asyncHandler(async (req, res) => {
    const { page } = parse(z.object({ page: z.coerce.number().int().min(1).default(1) }), req.query);
    const [data, total] = await Promise.all([prisma.emailLog.findMany({ orderBy: { createdAt: 'desc' }, skip: (page - 1) * 50, take: 50 }), prisma.emailLog.count()]);
    res.json({ data, meta: pageMeta(page, 50, total) });
  }),
);

/** Sends a campaign update to consenting newsletter subscribers (marketing — includes unsubscribe link). */
emailRouter.post(
  '/announce-campaign-update',
  asyncHandler(async (req, res) => {
    const { updateId } = parse(z.object({ updateId: z.string(), confirm: z.literal(true) }), req.body);
    const update = await prisma.campaignUpdate.findUniqueOrThrow({ where: { id: updateId }, include: { campaign: true } });
    if (update.status !== 'PUBLISHED') throw AppError.badRequest('Publish the update before announcing it');
    const subs = await prisma.newsletterSubscriber.findMany({ where: { status: 'SUBSCRIBED' } });
    const blocked = new Set((await prisma.donor.findMany({ where: { doNotContact: true }, select: { email: true } })).map((d) => d.email));
    let sent = 0;
    for (const s of subs.filter((x) => !blocked.has(x.email))) {
      const ok = await sendTemplate({
        to: s.email,
        template: 'campaign_update',
        vars: {
          name: s.name ? ` ${s.name}` : '',
          campaignTitle: update.campaign.title,
          updateTitle: update.title,
          updateBody: update.body.slice(0, 1500),
          campaignUrl: `${env.PUBLIC_SITE_URL}/campaigns/${update.campaign.slug}`,
          unsubscribeUrl: `${env.PUBLIC_SITE_URL}/unsubscribe?token=${s.unsubscribeToken}`,
        },
        related: { type: 'CampaignUpdate', id: update.id },
      });
      if (ok) sent++;
    }
    await audit(req, { action: 'campaign_update.announced', entityType: 'CampaignUpdate', entityId: update.id, summary: `${sent}/${subs.length} sent` });
    res.json({ data: { recipients: subs.length, sent } });
  }),
);
