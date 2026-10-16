import { Router, type Request } from 'express';
import { z } from 'zod';
import { paginationSchema, type CollectionDef } from '@ngo/shared';
import { prisma } from '../../config/db.js';
import { hasPermission, requireAuth } from '../../middleware/auth.js';
import { audit } from '../../services/audit.service.js';
import { checkRelations, checkRules, delegate, getCollection, inputSchema, toDb } from '../../services/collection.service.js';
import { bumpContentVersion } from '../../services/config.service.js';
import { AppError } from '../../utils/AppError.js';
import { toCsv } from '../../utils/csv.js';
import { asyncHandler, pageMeta, parse } from '../../utils/http.js';

export const collectionsRouter = Router();
collectionsRouter.use(requireAuth);

function authorize(req: Request, def: CollectionDef) {
  if (!hasPermission(req.user, def.permission)) throw AppError.forbidden();
}

/** Publishing (moving into a public status) may need an extra permission, e.g. content.publish. */
function authorizeStatus(req: Request, def: CollectionDef, next: string, prev?: string) {
  if (!def.publishPermission) return;
  const becomesPublic = def.publicStatuses.includes(next) && next !== prev;
  if (becomesPublic && !hasPermission(req.user, def.publishPermission)) throw AppError.forbidden('You can save drafts, but publishing needs approval from an editor with publish rights.');
}

collectionsRouter.get(
  '/:key/options',
  asyncHandler(async (req, res) => {
    // Lightweight id/label list for relation pickers — any staff member may read titles.
    const def = getCollection(req.params.key);
    const rows = await delegate(def).findMany({ select: { id: true, [def.titleField]: true, status: true }, orderBy: def.orderBy, take: 500 });
    res.json({ data: rows.map((r: Record<string, string>) => ({ id: r.id, label: r[def.titleField], status: r.status })) });
  }),
);

collectionsRouter.get(
  '/:key',
  asyncHandler(async (req, res) => {
    const def = getCollection(req.params.key);
    authorize(req, def);
    const { page, limit, q } = parse(paginationSchema, req.query);
    const where: Record<string, unknown> = {};
    if (typeof req.query.status === 'string' && req.query.status) where.status = req.query.status;
    if (q) where.OR = def.searchFields.map((f) => ({ [f]: { contains: q, mode: 'insensitive' } }));
    // Optional relation filter, e.g. ?campaignId=...
    for (const f of def.fields.filter((x) => x.type === 'relation')) {
      if (typeof req.query[f.name] === 'string') where[f.name] = req.query[f.name];
    }
    const db = delegate(def);
    if (req.query.format === 'csv') {
      const rows = await db.findMany({ where, orderBy: def.orderBy, take: 10000 });
      await audit(req, { action: 'collection.exported', entityType: def.key, summary: `${rows.length} rows` });
      res.type('text/csv').attachment(`${def.key}.csv`);
      return res.send(toCsv(rows, [{ key: 'id', label: 'ID' }, ...def.fields.filter((f) => f.type !== 'repeater').map((f) => ({ key: f.name, label: f.label })), { key: 'status', label: 'Status' }, { key: 'updatedAt', label: 'Updated' }]));
    }
    const [data, total] = await Promise.all([db.findMany({ where, orderBy: def.orderBy, skip: (page - 1) * limit, take: limit }), db.count({ where })]);
    res.json({ data, meta: pageMeta(page, limit, total) });
  }),
);

collectionsRouter.get(
  '/:key/:id',
  asyncHandler(async (req, res) => {
    const def = getCollection(req.params.key);
    authorize(req, def);
    const row = await delegate(def).findUnique({ where: { id: req.params.id } });
    if (!row) throw AppError.notFound();
    res.json({ data: row });
  }),
);

collectionsRouter.post(
  '/:key',
  asyncHandler(async (req, res) => {
    const def = getCollection(req.params.key);
    authorize(req, def);
    const data = parse(inputSchema(def), req.body) as Record<string, unknown>;
    authorizeStatus(req, def, String(data.status));
    checkRules(def, data);
    await checkRelations(def, data);
    const row = await delegate(def).create({ data: toDb(def, data) });
    await audit(req, { action: `${def.key}.created`, entityType: def.key, entityId: row.id, summary: String(row[def.titleField] ?? ''), after: row });
    await bumpContentVersion();
    res.status(201).json({ data: row });
  }),
);

collectionsRouter.put(
  '/:key/:id',
  asyncHandler(async (req, res) => {
    const def = getCollection(req.params.key);
    authorize(req, def);
    const db = delegate(def);
    const before = await db.findUnique({ where: { id: req.params.id } });
    if (!before) throw AppError.notFound();
    const data = parse(inputSchema(def), req.body) as Record<string, unknown>;
    authorizeStatus(req, def, String(data.status), before.status);
    checkRules(def, data);
    await checkRelations(def, data);
    // Editing sample records turns them into real content.
    const row = await db.update({ where: { id: req.params.id }, data: { ...toDb(def, data), isSample: false } });
    await audit(req, { action: `${def.key}.updated`, entityType: def.key, entityId: row.id, summary: String(row[def.titleField] ?? ''), before, after: row });
    await bumpContentVersion();
    res.json({ data: row });
  }),
);

collectionsRouter.post(
  '/:key/:id/duplicate',
  asyncHandler(async (req, res) => {
    const def = getCollection(req.params.key);
    authorize(req, def);
    const db = delegate(def);
    const src = await db.findUnique({ where: { id: req.params.id } });
    if (!src) throw AppError.notFound();
    const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = src;
    const copy = { ...rest, status: def.statusOptions[0].value, isSample: false } as Record<string, unknown>;
    if (def.hasSlug) copy.slug = `${src.slug}-copy-${Date.now().toString(36).slice(-4)}`;
    copy[def.titleField] = `${src[def.titleField]} (copy)`;
    const row = await db.create({ data: copy });
    await audit(req, { action: `${def.key}.duplicated`, entityType: def.key, entityId: row.id, summary: `from ${src.id}` });
    res.status(201).json({ data: row });
  }),
);

collectionsRouter.delete(
  '/:key/:id',
  asyncHandler(async (req, res) => {
    const def = getCollection(req.params.key);
    authorize(req, def);
    parse(z.object({ confirm: z.literal(true, { errorMap: () => ({ message: 'Confirmation required' }) }) }), req.body ?? {});
    const db = delegate(def);
    const before = await db.findUnique({ where: { id: req.params.id } });
    if (!before) throw AppError.notFound();
    if (def.key === 'campaigns') {
      const donations = await prisma.donation.count({ where: { campaignId: before.id } });
      if (donations) throw AppError.conflict('This campaign has donations. Archive it instead of deleting.');
    }
    await db.delete({ where: { id: req.params.id } });
    await audit(req, { action: `${def.key}.deleted`, entityType: def.key, entityId: before.id, summary: String(before[def.titleField] ?? ''), before });
    await bumpContentVersion();
    res.json({ data: { ok: true } });
  }),
);
