import { Router } from 'express';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { createSection, pageDraftSchema, sectionBaseSchema, slugSchema } from '@ngo/shared';
import { prisma } from '../../config/db.js';
import { requirePermission } from '../../middleware/auth.js';
import { audit } from '../../services/audit.service.js';
import { bumpContentVersion } from '../../services/config.service.js';
import { draftErrors, publishPage, readDraft } from '../../services/page.service.js';
import { AppError } from '../../utils/AppError.js';
import { asyncHandler, parse } from '../../utils/http.js';

export const pagesRouter = Router();
pagesRouter.use(requirePermission('website.pages'));

const RESERVED = ['admin', 'api', 'uploads', 'donate', 'donor', 'causes', 'campaigns', 'projects', 'events', 'stories', 'blog', 'gallery', 'search', 'volunteer'];

pagesRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const pages = await prisma.page.findMany({ orderBy: [{ isSystem: 'desc' }, { slug: 'asc' }], include: { publishedVersion: { select: { version: true, createdAt: true, data: true } } } });
    res.json({
      data: pages.map((p) => {
        const draft = readDraft(p.draft);
        return {
          id: p.id,
          slug: p.slug,
          title: draft.title,
          status: p.status,
          isSystem: p.isSystem,
          scheduledAt: p.scheduledAt,
          updatedAt: p.updatedAt,
          publishedVersion: p.publishedVersion?.version ?? null,
          publishedAt: p.publishedVersion?.createdAt ?? null,
          hasUnpublishedChanges: !p.publishedVersion || JSON.stringify(p.publishedVersion.data) !== JSON.stringify(draft),
          sectionCount: draft.sections.length,
        };
      }),
    });
  }),
);

pagesRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const body = parse(z.object({ title: z.string().trim().min(1).max(160), slug: slugSchema, template: z.enum(['blank', 'standard']).default('standard') }), req.body);
    if (RESERVED.includes(body.slug)) throw AppError.validation('This URL is reserved', [{ path: 'slug', message: 'Choose another URL' }]);
    const sections =
      body.template === 'standard'
        ? [
            createSection('hero', { heading: body.title, height: 'medium', images: [] }),
            createSection('richText', { body: 'Start writing here…' }),
            createSection('cta', { heading: 'Be part of the change', style: 'primary', ctas: [{ label: 'Donate now', href: '/donate', variant: 'accent' }] }),
          ]
        : [];
    const page = await prisma.page.create({
      data: { slug: body.slug, draft: { title: body.title, seo: { title: '', description: '', image: '', noIndex: false }, sections } as unknown as Prisma.InputJsonValue, updatedById: req.user!.id },
    });
    await audit(req, { action: 'page.created', entityType: 'Page', entityId: page.id, summary: body.slug });
    res.status(201).json({ data: page });
  }),
);

pagesRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const page = await prisma.page.findUnique({ where: { id: req.params.id }, include: { publishedVersion: { select: { version: true, createdAt: true } } } });
    if (!page) throw AppError.notFound();
    const draft = readDraft(page.draft);
    res.json({ data: { ...page, draft, validation: { errors: draftErrors(draft) } } });
  }),
);

pagesRouter.put(
  '/:id/draft',
  asyncHandler(async (req, res) => {
    const draft = parse(pageDraftSchema, req.body);
    const ids = new Set(draft.sections.map((s) => s.id));
    if (ids.size !== draft.sections.length) throw AppError.badRequest('Duplicate section ids');
    const page = await prisma.page.update({ where: { id: req.params.id }, data: { draft: draft as unknown as Prisma.InputJsonValue, updatedById: req.user!.id } });
    res.json({ data: { updatedAt: page.updatedAt, validation: { errors: draftErrors(draft) } } });
  }),
);

pagesRouter.put(
  '/:id/settings',
  asyncHandler(async (req, res) => {
    const body = parse(z.object({ slug: slugSchema, showInSitemap: z.boolean() }), req.body);
    const page = await prisma.page.findUniqueOrThrow({ where: { id: req.params.id } });
    if (page.isSystem && body.slug !== page.slug) throw AppError.badRequest('System page URLs cannot be changed');
    if (body.slug !== page.slug && RESERVED.includes(body.slug)) throw AppError.validation('This URL is reserved', [{ path: 'slug', message: 'Choose another URL' }]);
    const updated = await prisma.page.update({ where: { id: page.id }, data: body });
    await audit(req, { action: 'page.settings_updated', entityType: 'Page', entityId: page.id, before: { slug: page.slug }, after: body });
    await bumpContentVersion();
    res.json({ data: updated });
  }),
);

pagesRouter.post(
  '/:id/publish',
  asyncHandler(async (req, res) => {
    const { note } = parse(z.object({ note: z.string().max(200).default('') }), req.body ?? {});
    const version = await publishPage(req.params.id, note, req.user!.id);
    await audit(req, { action: 'page.published', entityType: 'Page', entityId: req.params.id, summary: `v${version.version} ${note}` });
    res.json({ data: { version: version.version } });
  }),
);

pagesRouter.post(
  '/:id/schedule',
  asyncHandler(async (req, res) => {
    const { at } = parse(z.object({ at: z.string().datetime() }), req.body);
    const when = new Date(at);
    if (when <= new Date()) throw AppError.validation('Choose a future time', [{ path: 'at', message: 'Must be in the future' }]);
    const page = await prisma.page.findUniqueOrThrow({ where: { id: req.params.id } });
    const errors = draftErrors(readDraft(page.draft));
    if (errors.length) throw AppError.validation('Fix the highlighted sections before scheduling', errors);
    await prisma.page.update({ where: { id: page.id }, data: { status: 'SCHEDULED', scheduledAt: when } });
    await audit(req, { action: 'page.scheduled', entityType: 'Page', entityId: page.id, summary: when.toISOString() });
    res.json({ data: { ok: true } });
  }),
);

pagesRouter.post(
  '/:id/unpublish',
  asyncHandler(async (req, res) => {
    const page = await prisma.page.findUniqueOrThrow({ where: { id: req.params.id } });
    if (page.slug === 'home') throw AppError.badRequest('The home page cannot be unpublished');
    await prisma.page.update({ where: { id: page.id }, data: { publishedVersionId: null, status: 'DRAFT', scheduledAt: null } });
    await audit(req, { action: 'page.unpublished', entityType: 'Page', entityId: page.id, summary: page.slug });
    await bumpContentVersion();
    res.json({ data: { ok: true } });
  }),
);

pagesRouter.get(
  '/:id/versions',
  asyncHandler(async (req, res) => {
    const versions = await prisma.pageVersion.findMany({
      where: { pageId: req.params.id },
      orderBy: { version: 'desc' },
      take: 50,
      select: { id: true, version: true, note: true, createdAt: true, createdById: true },
    });
    res.json({ data: versions });
  }),
);

pagesRouter.post(
  '/:id/versions/:versionId/restore',
  asyncHandler(async (req, res) => {
    const v = await prisma.pageVersion.findFirst({ where: { id: req.params.versionId, pageId: req.params.id } });
    if (!v) throw AppError.notFound();
    await prisma.page.update({ where: { id: req.params.id }, data: { draft: v.data as Prisma.InputJsonValue, updatedById: req.user!.id } });
    await audit(req, { action: 'page.version_restored', entityType: 'Page', entityId: req.params.id, summary: `v${v.version} copied to draft` });
    res.json({ data: { ok: true } });
  }),
);

pagesRouter.post(
  '/:id/duplicate',
  asyncHandler(async (req, res) => {
    const src = await prisma.page.findUniqueOrThrow({ where: { id: req.params.id } });
    const draft = readDraft(src.draft);
    const page = await prisma.page.create({
      data: { slug: `${src.slug}-copy-${Date.now().toString(36).slice(-4)}`, draft: { ...draft, title: `${draft.title} (copy)` } as unknown as Prisma.InputJsonValue, updatedById: req.user!.id },
    });
    await audit(req, { action: 'page.duplicated', entityType: 'Page', entityId: page.id, summary: `from ${src.slug}` });
    res.status(201).json({ data: page });
  }),
);

pagesRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    parse(z.object({ confirm: z.literal(true) }), req.body ?? {});
    const page = await prisma.page.findUniqueOrThrow({ where: { id: req.params.id } });
    if (page.isSystem) throw AppError.badRequest('System pages cannot be deleted');
    await prisma.page.update({ where: { id: page.id }, data: { publishedVersionId: null } });
    await prisma.page.delete({ where: { id: page.id } });
    await audit(req, { action: 'page.deleted', entityType: 'Page', entityId: page.id, summary: page.slug, before: page.draft });
    await bumpContentVersion();
    res.json({ data: { ok: true } });
  }),
);

// Reusable section templates
export const sectionTemplatesRouter = Router();
sectionTemplatesRouter.use(requirePermission('website.pages'));
sectionTemplatesRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    res.json({ data: await prisma.sectionTemplate.findMany({ orderBy: { createdAt: 'desc' } }) });
  }),
);
sectionTemplatesRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const body = parse(z.object({ name: z.string().trim().min(1).max(80), section: sectionBaseSchema }), req.body);
    const t = await prisma.sectionTemplate.create({ data: { name: body.name, type: body.section.type, section: body.section as unknown as Prisma.InputJsonValue } });
    await audit(req, { action: 'section_template.created', entityType: 'SectionTemplate', entityId: t.id, summary: body.name });
    res.status(201).json({ data: t });
  }),
);
sectionTemplatesRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    await prisma.sectionTemplate.delete({ where: { id: req.params.id } });
    await audit(req, { action: 'section_template.deleted', entityType: 'SectionTemplate', entityId: req.params.id });
    res.json({ data: { ok: true } });
  }),
);
