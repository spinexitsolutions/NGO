import { Router } from 'express';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../../config/db.js';
import { env } from '../../config/env.js';
import { hasPermission, requirePermission } from '../../middleware/auth.js';
import { audit } from '../../services/audit.service.js';
import { sendTemplate } from '../../services/email.service.js';
import { privateStorage } from '../../services/storage/index.js';
import { AppError } from '../../utils/AppError.js';
import { toCsv } from '../../utils/csv.js';
import { asyncHandler, pageMeta, parse } from '../../utils/http.js';

export const adminVolunteersRouter = Router();
const view = requirePermission('volunteers.view', 'volunteers.manage');
const manage = requirePermission('volunteers.manage');

const STATUS_LABEL: Record<string, string> = {
  SUBMITTED: 'Submitted',
  UNDER_REVIEW: 'Under review',
  INFO_REQUESTED: 'More information requested',
  APPROVED: 'Approved',
  REJECTED: 'Not selected this time',
  WITHDRAWN: 'Withdrawn',
};

adminVolunteersRouter.get(
  '/applications',
  view,
  asyncHandler(async (req, res) => {
    const q = parse(
      z.object({
        page: z.coerce.number().int().min(1).default(1),
        limit: z.coerce.number().int().min(1).max(100).default(25),
        status: z.enum(['SUBMITTED', 'UNDER_REVIEW', 'INFO_REQUESTED', 'APPROVED', 'REJECTED', 'WITHDRAWN']).optional(),
        opportunityId: z.string().optional(),
        q: z.string().max(200).optional(),
      }),
      req.query,
    );
    const where: Prisma.VolunteerApplicationWhereInput = {};
    if (q.status) where.status = q.status;
    if (q.opportunityId) where.opportunityId = q.opportunityId;
    if (q.q) where.OR = [{ reference: { contains: q.q } }, { profile: { name: { contains: q.q } } }, { profile: { email: { contains: q.q } } }, { profile: { city: { contains: q.q } } }];
    const [data, total, counts] = await Promise.all([
      prisma.volunteerApplication.findMany({
        where,
        include: { profile: { select: { name: true, email: true, city: true, interests: true } }, opportunity: { select: { title: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
      prisma.volunteerApplication.count({ where }),
      prisma.volunteerApplication.groupBy({ by: ['status'], _count: true }),
    ]);
    res.json({ data, meta: { ...pageMeta(q.page, q.limit, total), counts: Object.fromEntries(counts.map((c) => [c.status, c._count])) } });
  }),
);

adminVolunteersRouter.get(
  '/applications/:id',
  view,
  asyncHandler(async (req, res) => {
    const app = await prisma.volunteerApplication.findUnique({
      where: { id: req.params.id },
      include: { profile: { include: { applications: { select: { id: true, reference: true, status: true, createdAt: true } }, assignments: true } }, opportunity: true },
    });
    if (!app) throw AppError.notFound();
    const notes = await prisma.internalNote.findMany({ where: { entityType: 'VolunteerApplication', entityId: app.id }, include: { author: { select: { name: true } } }, orderBy: { createdAt: 'desc' } });
    const { resumeKey, ...profile } = app.profile;
    res.json({ data: { ...app, profile: { ...profile, hasResume: Boolean(resumeKey) }, notes } });
  }),
);

adminVolunteersRouter.post(
  '/applications/:id/status',
  manage,
  asyncHandler(async (req, res) => {
    const body = parse(
      z.object({
        status: z.enum(['UNDER_REVIEW', 'INFO_REQUESTED', 'APPROVED', 'REJECTED']),
        message: z.string().trim().max(1000).default(''),
        notify: z.boolean().default(true),
      }),
      req.body,
    );
    if (body.status === 'INFO_REQUESTED' && !body.message) throw AppError.validation('Tell the applicant what you need', [{ path: 'message', message: 'Required when requesting information' }]);
    const before = await prisma.volunteerApplication.findUniqueOrThrow({ where: { id: req.params.id }, include: { profile: true } });
    const app = await prisma.volunteerApplication.update({
      where: { id: before.id },
      data: { status: body.status, messageToApplicant: body.message, reviewedById: req.user!.id, reviewedAt: new Date() },
    });
    if (body.status === 'APPROVED') await prisma.volunteerProfile.update({ where: { id: before.profileId }, data: { status: 'ACTIVE' } });
    await audit(req, { action: 'volunteer_application.status', entityType: 'VolunteerApplication', entityId: app.id, before: { status: before.status }, after: { status: app.status } });
    if (body.notify && body.status !== 'UNDER_REVIEW') {
      await sendTemplate({
        to: before.profile.email,
        template: 'volunteer_status',
        vars: { name: before.profile.name, reference: app.reference, status: STATUS_LABEL[app.status], message: body.message, statusUrl: `${env.PUBLIC_SITE_URL}/volunteer/status?ref=${app.reference}` },
        related: { type: 'VolunteerApplication', id: app.id },
      });
    }
    res.json({ data: app });
  }),
);

adminVolunteersRouter.get(
  '/profiles',
  view,
  asyncHandler(async (req, res) => {
    const q = parse(
      z.object({
        page: z.coerce.number().int().min(1).default(1),
        limit: z.coerce.number().int().min(1).max(100).default(25),
        status: z.enum(['APPLICANT', 'ACTIVE', 'INACTIVE']).optional(),
        q: z.string().max(200).optional(),
        format: z.enum(['json', 'csv']).default('json'),
      }),
      req.query,
    );
    const where: Prisma.VolunteerProfileWhereInput = {};
    if (q.status) where.status = q.status;
    if (q.q) where.OR = [{ name: { contains: q.q } }, { email: { contains: q.q } }, { city: { contains: q.q } }];
    const take = q.format === 'csv' ? 20000 : q.limit;
    const rows = await prisma.volunteerProfile.findMany({ where, orderBy: { createdAt: 'desc' }, skip: q.format === 'csv' ? 0 : (q.page - 1) * q.limit, take, omit: { resumeKey: true } });
    const hours = await prisma.volunteerHours.groupBy({ by: ['profileId'], where: { profileId: { in: rows.map((r) => r.id) } }, _sum: { minutes: true } });
    const hmap = new Map(hours.map((h) => [h.profileId, Math.round((h._sum.minutes ?? 0) / 6) / 10]));
    const data = rows.map((r) => ({ ...r, hours: hmap.get(r.id) ?? 0 }));
    if (q.format === 'csv') {
      if (!hasPermission(req.user, 'volunteers.manage')) throw AppError.forbidden();
      await audit(req, { action: 'volunteers.exported', entityType: 'VolunteerProfile', summary: `${data.length} rows` });
      res.type('text/csv').attachment('volunteers.csv');
      return res.send(toCsv(data, ['name', 'email', 'phone', 'city', 'status', 'availability', 'interests', 'skills', 'hours', 'createdAt'].map((k) => ({ key: k, label: k }))));
    }
    res.json({ data, meta: pageMeta(q.page, q.limit, await prisma.volunteerProfile.count({ where })) });
  }),
);

adminVolunteersRouter.get(
  '/profiles/:id',
  view,
  asyncHandler(async (req, res) => {
    const p = await prisma.volunteerProfile.findUnique({
      where: { id: req.params.id },
      include: {
        applications: { include: { opportunity: { select: { title: true } } }, orderBy: { createdAt: 'desc' } },
        assignments: { include: { project: { select: { title: true } }, event: { select: { title: true } }, opportunity: { select: { title: true } } }, orderBy: { startDate: 'desc' } },
        hours: { orderBy: { date: 'desc' }, take: 100 },
      },
    });
    if (!p) throw AppError.notFound();
    const { resumeKey, ...rest } = p;
    res.json({ data: { ...rest, hasResume: Boolean(resumeKey) } });
  }),
);

adminVolunteersRouter.put(
  '/profiles/:id',
  manage,
  asyncHandler(async (req, res) => {
    const body = parse(z.object({ status: z.enum(['APPLICANT', 'ACTIVE', 'INACTIVE']), roleTitle: z.string().max(80) }), req.body);
    const p = await prisma.volunteerProfile.update({ where: { id: req.params.id }, data: body, omit: { resumeKey: true } });
    await audit(req, { action: 'volunteer.updated', entityType: 'VolunteerProfile', entityId: p.id, after: body });
    res.json({ data: p });
  }),
);

adminVolunteersRouter.get(
  '/profiles/:id/resume',
  view,
  asyncHandler(async (req, res) => {
    const p = await prisma.volunteerProfile.findUniqueOrThrow({ where: { id: req.params.id } });
    const path = p.resumeKey ? privateStorage.resolve(p.resumeKey) : null;
    if (!path) throw AppError.notFound('No resume uploaded');
    await audit(req, { action: 'volunteer.resume_viewed', entityType: 'VolunteerProfile', entityId: p.id });
    res.set('Cache-Control', 'no-store').type('application/pdf').sendFile(path);
  }),
);

const assignmentSchema = z.object({
  profileId: z.string(),
  role: z.string().trim().min(2).max(120),
  responsibilities: z.string().max(1000).default(''),
  projectId: z.string().nullable().default(null),
  eventId: z.string().nullable().default(null),
  opportunityId: z.string().nullable().default(null),
  startDate: z.string().date(),
  endDate: z.string().date().nullable().default(null),
  status: z.enum(['ACTIVE', 'COMPLETED', 'CANCELLED']).default('ACTIVE'),
});

adminVolunteersRouter.post(
  '/assignments',
  manage,
  asyncHandler(async (req, res) => {
    const b = parse(assignmentSchema, req.body);
    const profile = await prisma.volunteerProfile.findUniqueOrThrow({ where: { id: b.profileId } });
    if (profile.status !== 'ACTIVE') throw AppError.badRequest('Only active (approved) volunteers can be assigned');
    const a = await prisma.volunteerAssignment.create({ data: { ...b, startDate: new Date(b.startDate), endDate: b.endDate ? new Date(b.endDate) : null } });
    await audit(req, { action: 'volunteer.assigned', entityType: 'VolunteerAssignment', entityId: a.id, summary: `${profile.name} → ${b.role}` });
    res.status(201).json({ data: a });
  }),
);

adminVolunteersRouter.put(
  '/assignments/:id',
  manage,
  asyncHandler(async (req, res) => {
    const b = parse(assignmentSchema, req.body);
    const a = await prisma.volunteerAssignment.update({ where: { id: req.params.id }, data: { ...b, startDate: new Date(b.startDate), endDate: b.endDate ? new Date(b.endDate) : null } });
    await audit(req, { action: 'volunteer.assignment_updated', entityType: 'VolunteerAssignment', entityId: a.id });
    res.json({ data: a });
  }),
);

adminVolunteersRouter.post(
  '/hours',
  manage,
  asyncHandler(async (req, res) => {
    const b = parse(
      z.object({ profileId: z.string(), assignmentId: z.string().nullable().default(null), date: z.string().date(), hours: z.number().positive().max(24), activity: z.string().trim().min(2).max(200) }),
      req.body,
    );
    if (new Date(b.date) > new Date()) throw AppError.validation('Hours cannot be recorded for a future date', [{ path: 'date', message: 'Future date' }]);
    const h = await prisma.volunteerHours.create({
      data: { profileId: b.profileId, assignmentId: b.assignmentId, date: new Date(b.date), minutes: Math.round(b.hours * 60), activity: b.activity, approvedById: req.user!.id },
    });
    await audit(req, { action: 'volunteer.hours_recorded', entityType: 'VolunteerHours', entityId: h.id, summary: `${b.hours}h ${b.activity}` });
    res.status(201).json({ data: h });
  }),
);

adminVolunteersRouter.delete(
  '/hours/:id',
  manage,
  asyncHandler(async (req, res) => {
    parse(z.object({ confirm: z.literal(true) }), req.body ?? {});
    const h = await prisma.volunteerHours.delete({ where: { id: req.params.id } });
    await audit(req, { action: 'volunteer.hours_deleted', entityType: 'VolunteerHours', entityId: h.id, before: h });
    res.json({ data: { ok: true } });
  }),
);
