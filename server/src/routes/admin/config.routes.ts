import { Router, type Request } from 'express';
import { z } from 'zod';
import { THEME_PRESETS, zodIssues } from '@ngo/shared';
import { hasPermission, requireAuth } from '../../middleware/auth.js';
import { audit } from '../../services/audit.service.js';
import { CONFIG, getDraft, isConfigKey, listVersions, publish, restoreVersion, saveDraft, type ConfigKey } from '../../services/config.service.js';
import { AppError } from '../../utils/AppError.js';
import { asyncHandler, parse } from '../../utils/http.js';

/** Theme, site settings and navigation: draft → preview → publish, with version history. */
export const configRouter = Router();
configRouter.use(requireAuth);

function keyOf(req: Request): ConfigKey {
  const key = req.params.key;
  if (!isConfigKey(key)) throw AppError.notFound();
  if (!hasPermission(req.user, 'website.theme')) throw AppError.forbidden();
  return key;
}

configRouter.get('/presets/themes', (_req, res) => res.json({ data: THEME_PRESETS }));

configRouter.get(
  '/:key',
  asyncHandler(async (req, res) => {
    const key = keyOf(req);
    res.json({ data: { ...(await getDraft(key)), defaults: CONFIG[key].defaults } });
  }),
);

configRouter.put(
  '/:key/draft',
  asyncHandler(async (req, res) => {
    const key = keyOf(req);
    const r = CONFIG[key].schema.safeParse(req.body);
    if (!r.success) throw AppError.validation('Please fix the highlighted fields', zodIssues(r.error));
    await saveDraft(key, r.data, req.user!.id);
    res.json({ data: await getDraft(key) });
  }),
);

configRouter.post(
  '/:key/publish',
  asyncHandler(async (req, res) => {
    const key = keyOf(req);
    const { note } = parse(z.object({ note: z.string().max(200).default('') }), req.body ?? {});
    const before = await getDraft(key);
    const doc = await publish(key, note, req.user!.id);
    await audit(req, { action: `${key}.published`, entityType: 'ConfigDocument', entityId: key, summary: `v${doc.version} ${note}`, before: before.published, after: doc.published });
    res.json({ data: await getDraft(key) });
  }),
);

/** Discards unpublished changes. */
configRouter.post(
  '/:key/discard',
  asyncHandler(async (req, res) => {
    const key = keyOf(req);
    const current = await getDraft(key);
    await saveDraft(key, current.published, req.user!.id);
    res.json({ data: await getDraft(key) });
  }),
);

/** Resets the whole draft — or one top-level group (e.g. "colors", "announcement") — to defaults. */
configRouter.post(
  '/:key/reset',
  asyncHandler(async (req, res) => {
    const key = keyOf(req);
    const { group } = parse(z.object({ group: z.string().max(40).optional() }), req.body ?? {});
    const defaults = CONFIG[key].defaults as Record<string, unknown>;
    const current = (await getDraft(key)).draft as Record<string, unknown>;
    if (group && !(group in defaults)) throw AppError.badRequest('Unknown group');
    const next = group ? { ...current, [group]: defaults[group] } : defaults;
    await saveDraft(key, next as never, req.user!.id);
    await audit(req, { action: `${key}.reset`, entityType: 'ConfigDocument', entityId: key, summary: group ?? 'all' });
    res.json({ data: await getDraft(key) });
  }),
);

configRouter.get(
  '/:key/versions',
  asyncHandler(async (req, res) => {
    res.json({ data: await listVersions(keyOf(req)) });
  }),
);

configRouter.post(
  '/:key/versions/:versionId/restore',
  asyncHandler(async (req, res) => {
    const key = keyOf(req);
    const v = await restoreVersion(key, req.params.versionId, req.user!.id);
    if (!v) throw AppError.notFound();
    await audit(req, { action: `${key}.version_restored`, entityType: 'ConfigDocument', entityId: key, summary: `v${v.version} copied to draft` });
    res.json({ data: await getDraft(key) });
  }),
);
