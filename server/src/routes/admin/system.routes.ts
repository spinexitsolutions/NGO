import { Router } from 'express';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { ALL_PERMISSIONS, PERMISSIONS, SUPER_ADMIN_ROLE, isPermission, type Permission } from '@ngo/shared';
import { prisma } from '../../config/db.js';
import { hasPermission, requireAuth, requirePermission } from '../../middleware/auth.js';
import { audit } from '../../services/audit.service.js';
import { hashPassword, passwordSchema } from '../../services/auth.service.js';
import { netRaisedWhere } from '../../services/donation.service.js';
import { AppError } from '../../utils/AppError.js';
import { toCsv } from '../../utils/csv.js';
import { asyncHandler, pageMeta, parse } from '../../utils/http.js';

// ─── Staff users & roles ───────────────────────────────────────────────────────

export const usersRouter = Router();
usersRouter.use(requirePermission('users.manage'));

usersRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'asc' },
      select: { id: true, email: true, name: true, isActive: true, mfaEnabled: true, lastLoginAt: true, createdAt: true, lockedUntil: true, role: { select: { id: true, key: true, name: true } } },
    });
    res.json({ data: users });
  }),
);

const userSchema = z.object({ name: z.string().trim().min(2).max(100), email: z.string().trim().toLowerCase().email(), roleId: z.string() });

usersRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const b = parse(userSchema.extend({ password: passwordSchema }), req.body);
    const user = await prisma.user.create({
      data: { name: b.name, email: b.email, roleId: b.roleId, passwordHash: await hashPassword(b.password) },
      select: { id: true, email: true, name: true },
    });
    await audit(req, { action: 'user.created', entityType: 'User', entityId: user.id, summary: user.email });
    res.status(201).json({ data: user });
  }),
);

usersRouter.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const b = parse(userSchema.extend({ isActive: z.boolean() }), req.body);
    const before = await prisma.user.findUniqueOrThrow({ where: { id: req.params.id }, include: { role: true } });
    if (before.id === req.user!.id && (!b.isActive || b.roleId !== before.roleId)) throw AppError.badRequest('You cannot deactivate yourself or change your own role');
    // Never leave the organisation without an active super admin.
    if (before.role.key === SUPER_ADMIN_ROLE && (!b.isActive || b.roleId !== before.roleId)) {
      const others = await prisma.user.count({ where: { role: { key: SUPER_ADMIN_ROLE }, isActive: true, id: { not: before.id } } });
      if (!others) throw AppError.badRequest('At least one active Super Admin is required');
    }
    const user = await prisma.user.update({ where: { id: before.id }, data: b, select: { id: true, email: true, name: true, isActive: true, roleId: true } });
    if (!b.isActive) await prisma.session.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } });
    await audit(req, { action: 'user.updated', entityType: 'User', entityId: user.id, before: { name: before.name, email: before.email, roleId: before.roleId, isActive: before.isActive }, after: b });
    res.json({ data: user });
  }),
);

usersRouter.post(
  '/:id/reset-password',
  asyncHandler(async (req, res) => {
    const { password } = parse(z.object({ password: passwordSchema }), req.body);
    const now = new Date();
    await prisma.user.update({ where: { id: req.params.id }, data: { passwordHash: await hashPassword(password), passwordChangedAt: now, failedLoginCount: 0, lockedUntil: null } });
    await prisma.session.updateMany({ where: { userId: req.params.id, revokedAt: null }, data: { revokedAt: now } });
    await audit(req, { action: 'user.password_reset_by_admin', entityType: 'User', entityId: req.params.id });
    res.json({ data: { ok: true } });
  }),
);

usersRouter.post(
  '/:id/revoke-sessions',
  asyncHandler(async (req, res) => {
    const r = await prisma.session.updateMany({ where: { userId: req.params.id, revokedAt: null }, data: { revokedAt: new Date() } });
    await audit(req, { action: 'user.sessions_revoked', entityType: 'User', entityId: req.params.id, summary: `${r.count} sessions` });
    res.json({ data: { revoked: r.count } });
  }),
);

usersRouter.post(
  '/:id/disable-mfa',
  asyncHandler(async (req, res) => {
    await prisma.user.update({ where: { id: req.params.id }, data: { mfaEnabled: false, mfaSecret: null } });
    await audit(req, { action: 'user.mfa_reset_by_admin', entityType: 'User', entityId: req.params.id });
    res.json({ data: { ok: true } });
  }),
);

export const rolesRouter = Router();
rolesRouter.use(requireAuth);

rolesRouter.get(
  '/',
  requirePermission('users.manage'),
  asyncHandler(async (_req, res) => {
    const roles = await prisma.role.findMany({ include: { permissions: true, _count: { select: { users: true } } }, orderBy: { createdAt: 'asc' } });
    res.json({
      data: roles.map((r) => ({ ...r, permissions: r.key === SUPER_ADMIN_ROLE ? ALL_PERMISSIONS : r.permissions.map((p) => p.permissionKey) })),
      meta: { catalog: Object.entries(PERMISSIONS).map(([key, v]) => ({ key, ...v })) },
    });
  }),
);

const roleSchema = z.object({
  name: z.string().trim().min(2).max(60),
  description: z.string().max(300).default(''),
  permissions: z.array(z.string().refine(isPermission, 'Unknown permission')).max(ALL_PERMISSIONS.length),
});

rolesRouter.post(
  '/',
  requirePermission('users.manage'),
  asyncHandler(async (req, res) => {
    const b = parse(roleSchema.extend({ key: z.string().regex(/^[a-z][a-z0-9_]{2,40}$/) }), req.body);
    const role = await prisma.role.create({
      data: { key: b.key, name: b.name, description: b.description, permissions: { create: b.permissions.map((p) => ({ permissionKey: p })) } },
    });
    await audit(req, { action: 'role.created', entityType: 'Role', entityId: role.id, summary: b.key, after: b });
    res.status(201).json({ data: role });
  }),
);

rolesRouter.put(
  '/:id',
  requirePermission('users.manage'),
  asyncHandler(async (req, res) => {
    const b = parse(roleSchema, req.body);
    const before = await prisma.role.findUniqueOrThrow({ where: { id: req.params.id }, include: { permissions: true } });
    if (before.key === SUPER_ADMIN_ROLE) throw AppError.badRequest('The Super Admin role always has every permission');
    const role = await prisma.$transaction(async (tx) => {
      await tx.rolePermission.deleteMany({ where: { roleId: before.id } });
      return tx.role.update({
        where: { id: before.id },
        data: { name: b.name, description: b.description, permissions: { create: (b.permissions as Permission[]).map((p) => ({ permissionKey: p })) } },
      });
    });
    await audit(req, { action: 'role.updated', entityType: 'Role', entityId: role.id, summary: role.key, before: before.permissions.map((p) => p.permissionKey), after: b.permissions });
    res.json({ data: role });
  }),
);

rolesRouter.delete(
  '/:id',
  requirePermission('users.manage'),
  asyncHandler(async (req, res) => {
    parse(z.object({ confirm: z.literal(true) }), req.body ?? {});
    const role = await prisma.role.findUniqueOrThrow({ where: { id: req.params.id }, include: { _count: { select: { users: true } } } });
    if (role.isSystem) throw AppError.badRequest('Built-in roles cannot be deleted');
    if (role._count.users) throw AppError.conflict('Move users to another role before deleting this one');
    await prisma.role.delete({ where: { id: role.id } });
    await audit(req, { action: 'role.deleted', entityType: 'Role', entityId: role.id, summary: role.key });
    res.json({ data: { ok: true } });
  }),
);

// ─── Dashboard & reports ──────────────────────────────────────────────────────

export const dashboardRouter = Router();
dashboardRouter.use(requirePermission('dashboard.view'));

const rangeSchema = z.object({ from: z.string().date().optional(), to: z.string().date().optional() });
function range(q: z.infer<typeof rangeSchema>) {
  const to = q.to ? new Date(new Date(q.to).getTime() + 86_400_000) : new Date(Date.now() + 1000);
  const from = q.from ? new Date(q.from) : new Date(to.getTime() - 90 * 86_400_000);
  return { from, to };
}

dashboardRouter.get(
  '/overview',
  asyncHandler(async (req, res) => {
    const { from, to } = range(parse(rangeSchema, req.query));
    const now = new Date();
    const canFinance = hasPermission(req.user, 'donations.view');
    const inRange = { createdAt: { gte: from, lt: to } };
    const [statusBreakdown, raised, activeCampaigns, volunteers, pendingApps, activeProjects, upcomingEvents, newInquiries, recentAudit] = await Promise.all([
      canFinance ? prisma.donation.groupBy({ by: ['status'], where: inRange, _sum: { amount: true, refundedAmount: true }, _count: true }) : Promise.resolve([]),
      canFinance ? netRaisedWhere({ paidAt: { gte: from, lt: to } }) : Promise.resolve(null),
      prisma.campaign.count({ where: { status: 'ACTIVE', startDate: { lte: now }, OR: [{ endDate: null }, { endDate: { gte: now } }] } }),
      prisma.volunteerProfile.count({ where: { status: 'ACTIVE' } }),
      prisma.volunteerApplication.count({ where: { status: { in: ['SUBMITTED', 'UNDER_REVIEW'] } } }),
      prisma.project.count({ where: { status: 'PUBLISHED', phase: 'ONGOING' } }),
      prisma.event.count({ where: { status: 'PUBLISHED', startsAt: { gte: now } } }),
      prisma.contactInquiry.count({ where: { status: 'NEW' } }),
      prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 10, include: { actor: { select: { name: true } } } }),
    ]);

    let trend: { day: string; amount: number; count: number }[] = [];
    let campaigns: { id: string; title: string; goal: number; raised: number }[] = [];
    if (canFinance) {
      const rows = await prisma.$queryRaw<{ day: Date; amount: bigint; count: bigint }[]>`
        SELECT date_trunc('day', "paidAt") AS day, SUM("amount" - "refundedAmount") AS amount, COUNT(*) AS count
        FROM "Donation" WHERE "status" IN ('SUCCESS','PARTIALLY_REFUNDED') AND "paidAt" >= ${from} AND "paidAt" < ${to}
        GROUP BY 1 ORDER BY 1`;
      trend = rows.map((r) => ({ day: r.day.toISOString().slice(0, 10), amount: Number(r.amount), count: Number(r.count) }));
      const top = await prisma.$queryRaw<{ id: string; title: string; goal: number; raised: bigint }[]>`
        SELECT c."id", c."title", c."goalAmount" AS goal, COALESCE(SUM(d."amount" - d."refundedAmount") FILTER (WHERE d."status" IN ('SUCCESS','PARTIALLY_REFUNDED')), 0) AS raised
        FROM "Campaign" c LEFT JOIN "Donation" d ON d."campaignId" = c."id"
        WHERE c."status" IN ('ACTIVE','COMPLETED') GROUP BY c."id" ORDER BY raised DESC LIMIT 6`;
      campaigns = top.map((c) => ({ ...c, raised: Number(c.raised) }));
    }

    const byStatus = Object.fromEntries(statusBreakdown.map((s) => [s.status, { count: s._count, amount: s._sum.amount ?? 0, refunded: s._sum.refundedAmount ?? 0 }]));
    res.json({
      data: {
        range: { from, to },
        finance: canFinance
          ? {
              netRaised: raised?.raised ?? 0,
              successfulCount: raised?.count ?? 0,
              byStatus,
              trend,
              campaigns,
            }
          : null,
        counts: { activeCampaigns, volunteers, pendingApplications: pendingApps, activeProjects, upcomingEvents, newInquiries },
        recentActivity: recentAudit.map((a) => ({ id: a.id, action: a.action, summary: a.summary, entityType: a.entityType, actor: a.actor?.name ?? 'System', at: a.createdAt })),
      },
    });
  }),
);

export const reportsRouter = Router();
reportsRouter.use(requirePermission('reports.view'));

reportsRouter.get(
  '/:type',
  asyncHandler(async (req, res) => {
    const { from, to } = range(parse(rangeSchema, req.query));
    const format = req.query.format === 'csv' ? 'csv' : 'json';
    let rows: Record<string, unknown>[] = [];
    let columns: string[] = [];
    switch (req.params.type) {
      case 'donations-monthly': {
        if (!hasPermission(req.user, 'donations.view')) throw AppError.forbidden();
        const r = await prisma.$queryRaw<{ month: Date; status: string; count: bigint; amount: bigint; refunded: bigint }[]>`
          SELECT date_trunc('month', COALESCE("paidAt","createdAt")) AS month, "status", COUNT(*) AS count, SUM("amount") AS amount, SUM("refundedAmount") AS refunded
          FROM "Donation" WHERE COALESCE("paidAt","createdAt") >= ${from} AND COALESCE("paidAt","createdAt") < ${to}
          GROUP BY 1, 2 ORDER BY 1, 2`;
        rows = r.map((x) => ({ month: x.month.toISOString().slice(0, 7), status: x.status, count: Number(x.count), amount: Number(x.amount) / 100, refunded: Number(x.refunded) / 100 }));
        columns = ['month', 'status', 'count', 'amount', 'refunded'];
        break;
      }
      case 'campaigns': {
        if (!hasPermission(req.user, 'donations.view') && !hasPermission(req.user, 'campaigns.manage')) throw AppError.forbidden();
        const r = await prisma.$queryRaw<{ title: string; status: string; goal: number; raised: bigint; donors: bigint; gifts: bigint }[]>`
          SELECT c."title", c."status", c."goalAmount" AS goal,
            COALESCE(SUM(d."amount" - d."refundedAmount") FILTER (WHERE d."status" IN ('SUCCESS','PARTIALLY_REFUNDED')), 0) AS raised,
            COUNT(DISTINCT d."donorId") FILTER (WHERE d."status" IN ('SUCCESS','PARTIALLY_REFUNDED')) AS donors,
            COUNT(d."id") FILTER (WHERE d."status" IN ('SUCCESS','PARTIALLY_REFUNDED')) AS gifts
          FROM "Campaign" c LEFT JOIN "Donation" d ON d."campaignId" = c."id" AND COALESCE(d."paidAt", d."createdAt") >= ${from} AND COALESCE(d."paidAt", d."createdAt") < ${to}
          GROUP BY c."id" ORDER BY raised DESC`;
        rows = r.map((x) => ({ campaign: x.title, status: x.status, goal: x.goal / 100, raised: Number(x.raised) / 100, percent: x.goal ? Math.round((Number(x.raised) / x.goal) * 100) : 0, donors: Number(x.donors), gifts: Number(x.gifts) }));
        columns = ['campaign', 'status', 'goal', 'raised', 'percent', 'donors', 'gifts'];
        break;
      }
      case 'volunteers': {
        if (!hasPermission(req.user, 'volunteers.view') && !hasPermission(req.user, 'volunteers.manage')) throw AppError.forbidden();
        const r = await prisma.$queryRaw<{ name: string; city: string; status: string; minutes: bigint; assignments: bigint }[]>`
          SELECT p."name", p."city", p."status", COALESCE(SUM(h."minutes"), 0) AS minutes, (SELECT COUNT(*) FROM "VolunteerAssignment" a WHERE a."profileId" = p."id") AS assignments
          FROM "VolunteerProfile" p LEFT JOIN "VolunteerHours" h ON h."profileId" = p."id" AND h."date" >= ${from} AND h."date" < ${to}
          WHERE p."status" <> 'APPLICANT' GROUP BY p."id" ORDER BY minutes DESC`;
        rows = r.map((x) => ({ volunteer: x.name, city: x.city, status: x.status, hours: Math.round(Number(x.minutes) / 6) / 10, assignments: Number(x.assignments) }));
        columns = ['volunteer', 'city', 'status', 'hours', 'assignments'];
        break;
      }
      case 'events': {
        const r = await prisma.$queryRaw<{ title: string; startsAt: Date; status: string; capacity: number | null; confirmed: bigint; attended: bigint; volunteers: bigint }[]>`
          SELECT e."title", e."startsAt", e."status", e."capacity",
            COUNT(r."id") FILTER (WHERE r."status" = 'CONFIRMED' AND r."type" = 'ATTENDEE') AS confirmed,
            COUNT(r."id") FILTER (WHERE r."attended") AS attended,
            COUNT(r."id") FILTER (WHERE r."status" = 'CONFIRMED' AND r."type" = 'VOLUNTEER') AS volunteers
          FROM "Event" e LEFT JOIN "EventRegistration" r ON r."eventId" = e."id"
          WHERE e."startsAt" >= ${from} AND e."startsAt" < ${to} GROUP BY e."id" ORDER BY e."startsAt" DESC`;
        rows = r.map((x) => ({ event: x.title, date: x.startsAt.toISOString().slice(0, 10), status: x.status, capacity: x.capacity ?? '', registered: Number(x.confirmed), attended: Number(x.attended), volunteers: Number(x.volunteers) }));
        columns = ['event', 'date', 'status', 'capacity', 'registered', 'attended', 'volunteers'];
        break;
      }
      case 'projects': {
        const r = await prisma.project.findMany({ orderBy: { startDate: 'desc' }, include: { _count: { select: { reports: true, beneficiaries: true, assignments: true } } } });
        rows = r.map((p) => ({ project: p.title, phase: p.phase, location: p.location, start: p.startDate.toISOString().slice(0, 10), beneficiariesReached: p.beneficiariesReached ?? '', verified: p.beneficiariesVerified, updates: p._count.reports, beneficiaryRecords: p._count.beneficiaries, volunteerAssignments: p._count.assignments }));
        columns = ['project', 'phase', 'location', 'start', 'beneficiariesReached', 'verified', 'updates', 'beneficiaryRecords', 'volunteerAssignments'];
        break;
      }
      case 'assistance': {
        if (!hasPermission(req.user, 'beneficiaries.view') && !hasPermission(req.user, 'beneficiaries.manage')) throw AppError.forbidden();
        const r = await prisma.$queryRaw<{ month: Date; type: string; unit: string; records: bigint; quantity: number; people: bigint }[]>`
          SELECT date_trunc('month', "distributedAt") AS month, "type", "unit", COUNT(*) AS records, SUM("quantity") AS quantity, COUNT(DISTINCT "beneficiaryId") AS people
          FROM "AssistanceRecord" WHERE "distributedAt" >= ${from} AND "distributedAt" < ${to} GROUP BY 1, 2, 3 ORDER BY 1, 2`;
        rows = r.map((x) => ({ month: x.month.toISOString().slice(0, 7), type: x.type, quantity: Number(x.quantity), unit: x.unit, records: Number(x.records), people: Number(x.people) }));
        columns = ['month', 'type', 'quantity', 'unit', 'records', 'people'];
        break;
      }
      default:
        throw AppError.notFound('Unknown report');
    }
    if (format === 'csv') {
      await audit(req, { action: 'report.exported', entityType: 'Report', entityId: req.params.type });
      res.type('text/csv').attachment(`${req.params.type}-report.csv`);
      return res.send(toCsv(rows, columns.map((c) => ({ key: c, label: c }))));
    }
    res.json({ data: rows, meta: { columns, from, to } });
  }),
);

// ─── Audit log & notifications ────────────────────────────────────────────────

export const auditRouter = Router();
auditRouter.use(requirePermission('audit.view'));
auditRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const q = parse(z.object({ page: z.coerce.number().int().min(1).default(1), entityType: z.string().max(60).optional(), entityId: z.string().max(60).optional(), actorId: z.string().optional(), action: z.string().max(60).optional() }), req.query);
    const where: Prisma.AuditLogWhereInput = {};
    if (q.entityType) where.entityType = q.entityType;
    if (q.entityId) where.entityId = q.entityId;
    if (q.actorId) where.actorId = q.actorId;
    if (q.action) where.action = { contains: q.action };
    const [data, total] = await Promise.all([
      prisma.auditLog.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (q.page - 1) * 50, take: 50, include: { actor: { select: { name: true, email: true } } } }),
      prisma.auditLog.count({ where }),
    ]);
    res.json({ data, meta: pageMeta(q.page, 50, total) });
  }),
);

export const notificationsRouter = Router();
notificationsRouter.use(requireAuth);
notificationsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const perms = req.user!.roleKey === SUPER_ADMIN_ROLE ? ALL_PERMISSIONS : [...req.user!.permissions];
    const rows = await prisma.notification.findMany({
      where: { OR: [{ userId: req.user!.id }, { userId: null, permission: { in: perms } }] },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });
    res.json({ data: rows.map(({ readBy, ...n }) => ({ ...n, read: readBy.includes(req.user!.id) })), meta: { unread: rows.filter((n) => !n.readBy.includes(req.user!.id)).length } });
  }),
);
notificationsRouter.post(
  '/read-all',
  asyncHandler(async (req, res) => {
    await prisma.$executeRaw`UPDATE "Notification" SET "readBy" = array_append("readBy", ${req.user!.id}) WHERE NOT (${req.user!.id} = ANY("readBy"))`;
    res.json({ data: { ok: true } });
  }),
);
