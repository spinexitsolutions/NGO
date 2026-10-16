import type { Prisma } from '@prisma/client';
import { pageDraftSchema, validateSections, type PageDraft } from '@ngo/shared';
import { prisma } from '../config/db.js';
import { AppError } from '../utils/AppError.js';
import { bumpContentVersion } from './config.service.js';

export function readDraft(raw: unknown): PageDraft {
  const r = pageDraftSchema.safeParse(raw);
  return r.success ? r.data : { title: '', seo: { title: '', description: '', image: '', noIndex: false }, sections: [] };
}

export function draftErrors(draft: PageDraft) {
  return validateSections(draft.sections).errors;
}

/** Validates the full draft and writes an immutable version. Throws 422 with per-section errors. */
export async function publishPage(pageId: string, note: string, userId?: string) {
  const page = await prisma.page.findUniqueOrThrow({ where: { id: pageId } });
  const draft = readDraft(page.draft);
  if (!draft.title.trim()) throw AppError.validation('The page needs a title before publishing', [{ index: -1, id: 'title', type: 'page', issues: [{ path: 'title', message: 'Title is required' }] }]);
  const { sections, errors } = validateSections(draft.sections);
  if (errors.length) throw AppError.validation(`${errors.length} section(s) need attention before publishing`, errors);
  const data = { ...draft, sections } as unknown as Prisma.InputJsonValue;
  const version = await prisma.$transaction(async (tx) => {
    const last = await tx.pageVersion.findFirst({ where: { pageId }, orderBy: { version: 'desc' }, select: { version: true } });
    const v = await tx.pageVersion.create({ data: { pageId, version: (last?.version ?? 0) + 1, data, note, createdById: userId } });
    await tx.page.update({ where: { id: pageId }, data: { publishedVersionId: v.id, status: 'PUBLISHED', scheduledAt: null, updatedById: userId } });
    return v;
  });
  await bumpContentVersion();
  return version;
}

/** Publishes pages and blog posts whose scheduled time has passed. Called by the job runner. */
export async function runScheduledPublishing(now = new Date()) {
  const due = await prisma.page.findMany({ where: { status: 'SCHEDULED', scheduledAt: { lte: now } }, select: { id: true } });
  let published = 0;
  for (const p of due) {
    try {
      await publishPage(p.id, 'Scheduled publish');
      published++;
    } catch {
      // Invalid drafts stay scheduled-but-unpublished; editors see the errors in the builder.
      await prisma.page.update({ where: { id: p.id }, data: { status: 'DRAFT' } });
    }
  }
  const posts = await prisma.blogPost.updateMany({ where: { status: 'SCHEDULED', publishedAt: { lte: now } }, data: { status: 'PUBLISHED' } });
  if (posts.count) await bumpContentVersion();
  return { pages: published, posts: posts.count };
}
