import { Router } from 'express';
import { z } from 'zod';
import { paginationSchema } from '@ngo/shared';
import { prisma } from '../../config/db.js';
import { requirePermission, requireAuth } from '../../middleware/auth.js';
import { upload } from '../../middleware/upload.js';
import { audit } from '../../services/audit.service.js';
import { findUsage, removeStoredFiles, replaceUpload, storeUpload } from '../../services/media.service.js';
import { AppError } from '../../utils/AppError.js';
import { asyncHandler, pageMeta, parse } from '../../utils/http.js';

export const mediaRouter = Router();
mediaRouter.use(requireAuth);

// Any staff member can browse the library (needed by every editor's image picker).
mediaRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const { page, limit, q } = parse(paginationSchema.extend({ limit: z.coerce.number().int().min(1).max(100).default(40) }), req.query);
    const where: Record<string, unknown> = {};
    if (typeof req.query.kind === 'string' && ['IMAGE', 'VIDEO', 'DOCUMENT'].includes(req.query.kind)) where.kind = req.query.kind;
    if (typeof req.query.folder === 'string' && req.query.folder) where.folder = req.query.folder;
    if (q) where.OR = [{ filename: { contains: q, mode: 'insensitive' } }, { alt: { contains: q, mode: 'insensitive' } }, { caption: { contains: q, mode: 'insensitive' } }];
    const [data, total, folders] = await Promise.all([
      prisma.mediaAsset.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
      prisma.mediaAsset.count({ where }),
      prisma.mediaAsset.groupBy({ by: ['folder'], _count: true }),
    ]);
    res.json({ data, meta: { ...pageMeta(page, limit, total), folders: folders.map((f) => ({ name: f.folder, count: f._count })) } });
  }),
);

mediaRouter.post(
  '/',
  requirePermission('media.manage', 'website.pages', 'content.manage', 'campaigns.manage', 'projects.manage', 'events.manage', 'blog.manage', 'website.theme'),
  upload.array('files', 10),
  asyncHandler(async (req, res) => {
    const files = (req.files as Express.Multer.File[] | undefined) ?? [];
    if (!files.length) throw AppError.badRequest('Choose at least one file');
    const { folder, alt } = parse(z.object({ folder: z.string().max(40).default('general'), alt: z.string().max(200).default('') }), req.body);
    const created = [];
    const failed: { file: string; message: string }[] = [];
    for (const f of files) {
      try {
        created.push(await storeUpload(f, { folder, alt, userId: req.user!.id }));
      } catch (err) {
        failed.push({ file: f.originalname, message: err instanceof AppError ? err.message : 'Could not process file' });
      }
    }
    if (created.length) await audit(req, { action: 'media.uploaded', entityType: 'MediaAsset', summary: created.map((c) => c.filename).join(', ') });
    if (!created.length) throw AppError.badRequest(failed[0]?.message ?? 'Upload failed', failed);
    res.status(201).json({ data: created, meta: { failed } });
  }),
);

mediaRouter.get(
  '/:id/usage',
  asyncHandler(async (req, res) => {
    const asset = await prisma.mediaAsset.findUniqueOrThrow({ where: { id: req.params.id } });
    res.json({ data: await findUsage(asset.url) });
  }),
);

mediaRouter.put(
  '/:id',
  requirePermission('media.manage'),
  asyncHandler(async (req, res) => {
    const body = parse(z.object({ alt: z.string().max(200), caption: z.string().max(300), folder: z.string().trim().min(1).max(40) }), req.body);
    const asset = await prisma.mediaAsset.update({ where: { id: req.params.id }, data: body });
    res.json({ data: asset });
  }),
);

mediaRouter.post(
  '/:id/replace',
  requirePermission('media.manage'),
  upload.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) throw AppError.badRequest('Choose a file');
    const result = await replaceUpload(req.params.id, req.file);
    await audit(req, { action: 'media.replaced', entityType: 'MediaAsset', entityId: req.params.id, summary: `${result.referencesUpdated} reference(s) updated` });
    res.json({ data: result });
  }),
);

mediaRouter.delete(
  '/:id',
  requirePermission('media.manage'),
  asyncHandler(async (req, res) => {
    const { force } = parse(z.object({ confirm: z.literal(true), force: z.boolean().default(false) }), req.body ?? {});
    const asset = await prisma.mediaAsset.findUniqueOrThrow({ where: { id: req.params.id } });
    const usage = await findUsage(asset.url);
    if (usage.length && !force) throw AppError.conflict(`This file is used in ${usage.length} place(s). Replace it instead, or confirm deletion.`, usage);
    await prisma.mediaAsset.delete({ where: { id: asset.id } });
    await removeStoredFiles(asset.storageKey, asset.variants as Record<string, string>);
    await audit(req, { action: 'media.deleted', entityType: 'MediaAsset', entityId: asset.id, summary: asset.filename, before: asset });
    res.json({ data: { ok: true } });
  }),
);
