import { Router } from 'express';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { COLLECTION_MAP, percent } from '@ngo/shared';
import { prisma } from '../config/db.js';
import { env } from '../config/env.js';
import { delegate, getCollection, toPublic } from '../services/collection.service.js';
import { contentVersion, getPublished } from '../services/config.service.js';
import { campaignTotals, netRaisedWhere } from '../services/donation.service.js';
import { readDraft } from '../services/page.service.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler, pageMeta, parse, strings } from '../utils/http.js';

export const publicRouter = Router();

// Small shared cache header for public, versioned content.
publicRouter.use((_req, res, next) => {
  res.set('Cache-Control', 'public, max-age=30, stale-while-revalidate=120');
  next();
});

/** Everything the public site needs to render chrome: published theme, settings, navigation. */
publicRouter.get(
  '/site',
  asyncHandler(async (_req, res) => {
    const [theme, settings, navigation, version] = await Promise.all([getPublished('theme'), getPublished('settings'), getPublished('navigation'), contentVersion()]);
    // Registration details are only exposed when verified.
    const registration = settings.registration.verified ? settings.registration : { ...settings.registration, legalName: '', registrationNumber: '', pan: '', otherCredentials: [], taxExemptionText: '', taxExemptionEnabled: false };
    // Bank details only when enabled.
    const donation = {
      ...settings.donation,
      bankTransfer: settings.donation.bankTransfer.enabled ? settings.donation.bankTransfer : { enabled: false },
      upi: settings.donation.upi.enabled ? settings.donation.upi : { enabled: false },
    };
    res.json({ data: { theme, settings: { ...settings, registration, donation }, navigation, version, paymentProvider: env.PAYMENT_PROVIDER } });
  }),
);

publicRouter.get(
  '/site/version',
  asyncHandler(async (_req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json({ data: { version: await contentVersion() } });
  }),
);

publicRouter.get(
  '/pages/:slug',
  asyncHandler(async (req, res) => {
    const page = await prisma.page.findUnique({ where: { slug: req.params.slug }, include: { publishedVersion: true } });
    if (!page?.publishedVersion) throw AppError.notFound('Page not found');
    res.json({ data: { slug: page.slug, ...(page.publishedVersion.data as object), updatedAt: page.publishedVersion.createdAt } });
  }),
);

// ─── Campaign helpers ────────────────────────────────────────────────────────────

type CampaignRow = Prisma.CampaignGetPayload<{ include: { cause: { select: { title: true; slug: true } } } }>;

async function withTotals(rows: CampaignRow[]) {
  const totals = await campaignTotals(rows.map((r) => r.id));
  const now = new Date();
  return rows.map((c) => {
    const t = totals.get(c.id) ?? { raised: 0, donors: 0 };
    const phase = c.status === 'COMPLETED' || (c.endDate && c.endDate < now) ? 'completed' : c.startDate > now ? 'upcoming' : 'active';
    return { ...toPublic(COLLECTION_MAP.campaigns, c as unknown as Record<string, unknown>), raised: t.raised, donors: t.donors, percent: percent(t.raised, c.goalAmount), phase };
  });
}

publicRouter.get(
  '/campaigns',
  asyncHandler(async (req, res) => {
    const q = parse(
      z.object({
        phase: z.enum(['active', 'upcoming', 'completed', 'all']).default('all'),
        featured: z.enum(['true', 'false']).optional(),
        cause: z.string().max(120).optional(),
        q: z.string().max(100).optional(),
        limit: z.coerce.number().int().min(1).max(50).default(24),
      }),
      req.query,
    );
    const now = new Date();
    const where: Prisma.CampaignWhereInput = { status: { in: ['ACTIVE', 'COMPLETED'] } };
    if (q.phase === 'active') Object.assign(where, { status: 'ACTIVE', startDate: { lte: now }, OR: [{ endDate: null }, { endDate: { gte: now } }] });
    if (q.phase === 'upcoming') Object.assign(where, { status: 'ACTIVE', startDate: { gt: now } });
    if (q.phase === 'completed') where.OR = [{ status: 'COMPLETED' }, { endDate: { lt: now } }];
    if (q.featured === 'true') where.isFeatured = true;
    if (q.cause) where.cause = { slug: q.cause };
    if (q.q) where.AND = [{ OR: [{ title: { contains: q.q, mode: 'insensitive' } }, { summary: { contains: q.q, mode: 'insensitive' } }] }];
    const rows = await prisma.campaign.findMany({ where, include: { cause: { select: { title: true, slug: true } } }, orderBy: [{ isFeatured: 'desc' }, { startDate: 'desc' }], take: q.limit });
    res.json({ data: await withTotals(rows) });
  }),
);

publicRouter.get(
  '/campaigns/:slug',
  asyncHandler(async (req, res) => {
    const c = await prisma.campaign.findFirst({ where: { slug: req.params.slug, status: { in: ['ACTIVE', 'COMPLETED'] } }, include: { cause: { select: { title: true, slug: true } } } });
    if (!c) throw AppError.notFound('Campaign not found');
    const [withT] = await withTotals([c]);
    const [updates, projects, recent] = await Promise.all([
      prisma.campaignUpdate.findMany({ where: { campaignId: c.id, status: 'PUBLISHED' }, orderBy: { publishedAt: 'desc' } }),
      prisma.project.findMany({ where: { campaignId: c.id, status: 'PUBLISHED' }, select: { slug: true, title: true, summary: true, coverImage: true, coverAlt: true, location: true }, take: 6 }),
      prisma.donation.findMany({
        where: { campaignId: c.id, status: { in: ['SUCCESS', 'PARTIALLY_REFUNDED'] } },
        orderBy: { paidAt: 'desc' },
        take: 8,
        select: { amount: true, currency: true, paidAt: true, isAnonymous: true, donor: { select: { name: true } } },
      }),
    ]);
    res.json({
      data: {
        ...withT,
        updates,
        projects,
        // Only first names of donors who did not choose anonymity; no emails or full names.
        recentSupporters: recent.map((d) => ({ name: d.isAnonymous ? 'Anonymous' : d.donor.name.split(' ')[0], amount: d.amount, currency: d.currency, at: d.paidAt })),
      },
    });
  }),
);

publicRouter.get(
  '/causes/:slug',
  asyncHandler(async (req, res) => {
    const cause = await prisma.cause.findFirst({ where: { slug: req.params.slug, status: 'PUBLISHED' } });
    if (!cause) throw AppError.notFound('Cause not found');
    const [campaigns, projects, stories] = await Promise.all([
      prisma.campaign.findMany({ where: { causeId: cause.id, status: 'ACTIVE' }, include: { cause: { select: { title: true, slug: true } } }, take: 3, orderBy: { startDate: 'desc' } }),
      prisma.project.findMany({ where: { causeId: cause.id, status: 'PUBLISHED' }, take: 6, orderBy: { startDate: 'desc' } }),
      prisma.story.findMany({ where: { causeId: cause.id, status: 'PUBLISHED', consentObtained: true }, take: 3, orderBy: { publishedAt: 'desc' } }),
    ]);
    res.json({
      data: {
        ...cause,
        campaigns: await withTotals(campaigns),
        projects: projects.map((p) => toPublic(COLLECTION_MAP.projects, p as unknown as Record<string, unknown>)),
        stories: stories.map((s) => toPublic(COLLECTION_MAP.stories, s as unknown as Record<string, unknown>)),
      },
    });
  }),
);

publicRouter.get(
  '/projects/:slug',
  asyncHandler(async (req, res) => {
    const p = await prisma.project.findFirst({
      where: { slug: req.params.slug, status: 'PUBLISHED' },
      include: { cause: { select: { title: true, slug: true } }, campaign: { select: { title: true, slug: true, status: true } } },
    });
    if (!p) throw AppError.notFound('Project not found');
    const [reports, stories, opportunities] = await Promise.all([
      prisma.projectReport.findMany({ where: { projectId: p.id, status: 'PUBLISHED' }, orderBy: { publishedAt: 'desc' } }),
      prisma.story.findMany({ where: { projectId: p.id, status: 'PUBLISHED', consentObtained: true }, take: 3 }),
      prisma.volunteerOpportunity.findMany({ where: { projectId: p.id, status: 'OPEN' }, take: 3 }),
    ]);
    res.json({
      data: {
        ...toPublic(COLLECTION_MAP.projects, p as unknown as Record<string, unknown>),
        reports,
        stories: stories.map((s) => toPublic(COLLECTION_MAP.stories, s as unknown as Record<string, unknown>)),
        opportunities,
      },
    });
  }),
);

publicRouter.get(
  '/events/:slug',
  asyncHandler(async (req, res) => {
    const e = await prisma.event.findFirst({ where: { slug: req.params.slug, status: { in: ['PUBLISHED', 'CANCELLED'] } }, include: { campaign: { select: { slug: true, title: true } } } });
    if (!e) throw AppError.notFound('Event not found');
    const counts = await prisma.eventRegistration.groupBy({ by: ['type'], where: { eventId: e.id, status: 'CONFIRMED' }, _sum: { guests: true }, _count: true });
    const attendees = counts.find((c) => c.type === 'ATTENDEE');
    const volunteers = counts.find((c) => c.type === 'VOLUNTEER');
    const taken = (attendees?._count ?? 0) + (attendees?._sum.guests ?? 0);
    res.json({
      data: {
        ...e,
        spotsLeft: e.capacity ? Math.max(0, e.capacity - taken) : null,
        volunteerSpotsLeft: e.volunteerSlots ? Math.max(0, e.volunteerSlots - (volunteers?._count ?? 0)) : 0,
        isPast: (e.endsAt ?? e.startsAt) < new Date(),
      },
    });
  }),
);

publicRouter.get(
  '/posts',
  asyncHandler(async (req, res) => {
    const q = parse(
      z.object({
        page: z.coerce.number().int().min(1).default(1),
        limit: z.coerce.number().int().min(1).max(30).default(9),
        category: z.string().max(120).optional(),
        tag: z.string().max(60).optional(),
        q: z.string().max(100).optional(),
      }),
      req.query,
    );
    const where: Prisma.BlogPostWhereInput = { status: 'PUBLISHED', publishedAt: { lte: new Date() } };
    if (q.category) where.category = { slug: q.category };
    if (q.q) where.OR = [{ title: { contains: q.q, mode: 'insensitive' } }, { excerpt: { contains: q.q, mode: 'insensitive' } }, { body: { contains: q.q, mode: 'insensitive' } }];
    const include = { category: { select: { name: true, slug: true } } };
    const categories = await prisma.category.findMany({ where: { status: 'PUBLISHED' }, select: { name: true, slug: true }, orderBy: { name: 'asc' } });
    if (q.tag) {
      // Tags are a JSON list: filter in memory (blog volumes are small).
      const all = (await prisma.blogPost.findMany({ where, orderBy: { publishedAt: 'desc' }, include, omit: { body: true } })).filter((p) => strings(p.tags).includes(q.tag!));
      return res.json({ data: all.slice((q.page - 1) * q.limit, q.page * q.limit), meta: { ...pageMeta(q.page, q.limit, all.length), categories } });
    }
    const [data, total] = await Promise.all([
      prisma.blogPost.findMany({ where, orderBy: { publishedAt: 'desc' }, skip: (q.page - 1) * q.limit, take: q.limit, include, omit: { body: true } }),
      prisma.blogPost.count({ where }),
    ]);
    res.json({ data, meta: { ...pageMeta(q.page, q.limit, total), categories } });
  }),
);

publicRouter.get(
  '/posts/:slug',
  asyncHandler(async (req, res) => {
    const post = await prisma.blogPost.findFirst({ where: { slug: req.params.slug, status: 'PUBLISHED', publishedAt: { lte: new Date() } }, include: { category: { select: { name: true, slug: true } } } });
    if (!post) throw AppError.notFound('Article not found');
    // Related: same category or shared tags.
    const tags = strings(post.tags);
    const candidates = await prisma.blogPost.findMany({
      where: { status: 'PUBLISHED', id: { not: post.id }, publishedAt: { lte: new Date() } },
      orderBy: { publishedAt: 'desc' },
      take: 50,
      omit: { body: true },
    });
    const related = candidates.filter((p) => (post.categoryId && p.categoryId === post.categoryId) || strings(p.tags).some((t) => tags.includes(t))).slice(0, 3);
    res.json({ data: { ...post, related } });
  }),
);

publicRouter.get(
  '/search',
  asyncHandler(async (req, res) => {
    const { q } = parse(z.object({ q: z.string().trim().min(2).max(100) }), req.query);
    const c = { contains: q, mode: 'insensitive' as const };
    const [causes, campaigns, projects, stories, posts, events, pages] = await Promise.all([
      prisma.cause.findMany({ where: { status: 'PUBLISHED', OR: [{ title: c }, { summary: c }] }, select: { slug: true, title: true, summary: true, coverImage: true }, take: 5 }),
      prisma.campaign.findMany({ where: { status: { in: ['ACTIVE', 'COMPLETED'] }, OR: [{ title: c }, { summary: c }] }, select: { slug: true, title: true, summary: true, coverImage: true }, take: 5 }),
      prisma.project.findMany({ where: { status: 'PUBLISHED', OR: [{ title: c }, { summary: c }, { location: c }] }, select: { slug: true, title: true, summary: true, coverImage: true }, take: 5 }),
      prisma.story.findMany({ where: { status: 'PUBLISHED', consentObtained: true, OR: [{ title: c }, { excerpt: c }] }, select: { slug: true, title: true, excerpt: true, image: true }, take: 5 }),
      prisma.blogPost.findMany({ where: { status: 'PUBLISHED', publishedAt: { lte: new Date() }, OR: [{ title: c }, { excerpt: c }] }, select: { slug: true, title: true, excerpt: true, coverImage: true }, take: 5 }),
      prisma.event.findMany({ where: { status: 'PUBLISHED', OR: [{ title: c }, { summary: c }] }, select: { slug: true, title: true, summary: true, coverImage: true }, take: 5 }),
      prisma.page.findMany({ where: { publishedVersionId: { not: null } }, select: { slug: true, publishedVersion: { select: { data: true } } } }),
    ]);
    const lower = q.toLowerCase();
    const pageHits = pages
      .map((p) => ({ slug: p.slug, title: readDraft(p.publishedVersion?.data).title }))
      .filter((p) => p.title.toLowerCase().includes(lower))
      .slice(0, 5);
    res.json({
      data: [
        ...causes.map((x) => ({ type: 'Cause', href: `/causes/${x.slug}`, title: x.title, text: x.summary, image: x.coverImage })),
        ...campaigns.map((x) => ({ type: 'Campaign', href: `/campaigns/${x.slug}`, title: x.title, text: x.summary, image: x.coverImage })),
        ...projects.map((x) => ({ type: 'Project', href: `/projects/${x.slug}`, title: x.title, text: x.summary, image: x.coverImage })),
        ...stories.map((x) => ({ type: 'Story', href: `/stories/${x.slug}`, title: x.title, text: x.excerpt, image: x.image })),
        ...posts.map((x) => ({ type: 'Article', href: `/blog/${x.slug}`, title: x.title, text: x.excerpt, image: x.coverImage })),
        ...events.map((x) => ({ type: 'Event', href: `/events/${x.slug}`, title: x.title, text: x.summary, image: x.coverImage })),
        ...pageHits.map((x) => ({ type: 'Page', href: x.slug === 'home' ? '/' : `/${x.slug}`, title: x.title, text: '', image: '' })),
      ],
    });
  }),
);

publicRouter.get(
  '/impact-summary',
  asyncHandler(async (_req, res) => {
    // Aggregates only — no personal data. Shown on the transparency page.
    const [donations, volunteers, hours, events, assistance] = await Promise.all([
      netRaisedWhere(),
      prisma.volunteerProfile.count({ where: { status: 'ACTIVE' } }),
      prisma.volunteerHours.aggregate({ _sum: { minutes: true } }),
      prisma.event.count({ where: { status: 'PUBLISHED', startsAt: { lt: new Date() } } }),
      prisma.assistanceRecord.count(),
    ]);
    res.json({ data: { donationsCount: donations.count, activeVolunteers: volunteers, volunteerHours: Math.round((hours._sum.minutes ?? 0) / 60), eventsHeld: events, assistanceRecords: assistance } });
  }),
);

/** Generic list/detail for the remaining collections. Only public statuses and public fields. */
const GENERIC_FILTERS: Record<string, string[]> = {
  causes: [],
  projects: ['phase'],
  stories: [],
  testimonials: [],
  team: ['group'],
  partners: ['type'],
  impactStats: [],
  faqs: ['category'],
  documents: ['type'],
  galleryAlbums: [],
  opportunities: [],
  jobs: ['type'],
  events: [],
};

publicRouter.get(
  '/c/:key',
  asyncHandler(async (req, res) => {
    if (!(req.params.key in GENERIC_FILTERS)) throw AppError.notFound();
    const def = getCollection(req.params.key);
    const { limit, page } = parse(z.object({ limit: z.coerce.number().int().min(1).max(100).default(50), page: z.coerce.number().int().min(1).default(1) }), req.query);
    const where: Record<string, unknown> = { status: { in: [...def.publicStatuses] } };
    for (const f of GENERIC_FILTERS[def.key]) if (typeof req.query[f] === 'string' && req.query[f] !== 'all') where[f] = req.query[f];
    if (def.key === 'stories' || def.key === 'testimonials') where.consentObtained = true;
    if (def.key === 'events') {
      const now = new Date();
      if (req.query.when === 'past') where.startsAt = { lt: now };
      else if (req.query.when !== 'all') where.OR = [{ startsAt: { gte: now } }, { endsAt: { gte: now } }];
    }
    if (def.key === 'causes' && typeof req.query.cause === 'string') where.slug = req.query.cause;
    if (def.key === 'projects' && typeof req.query.cause === 'string') where.cause = { slug: req.query.cause };
    if (def.key === 'opportunities') where.OR = [{ deadline: null }, { deadline: { gte: new Date(new Date().toDateString()) } }];
    const orderBy = def.key === 'events' && req.query.when !== 'past' ? [{ startsAt: 'asc' }] : def.orderBy;
    const db = delegate(def);
    const [rows, total] = await Promise.all([db.findMany({ where, orderBy, take: limit, skip: (page - 1) * limit }), db.count({ where })]);
    res.json({ data: rows.map((r: Record<string, unknown>) => toPublic(def, r)), meta: pageMeta(page, limit, total) });
  }),
);

publicRouter.get(
  '/c/:key/:slug',
  asyncHandler(async (req, res) => {
    if (!(req.params.key in GENERIC_FILTERS)) throw AppError.notFound();
    const def = getCollection(req.params.key);
    if (!def.hasSlug) throw AppError.notFound();
    const where: Record<string, unknown> = { slug: req.params.slug, status: { in: [...def.publicStatuses] } };
    if (def.key === 'stories') where.consentObtained = true;
    const row = await delegate(def).findFirst({ where });
    if (!row) throw AppError.notFound();
    res.json({ data: toPublic(def, row) });
  }),
);
