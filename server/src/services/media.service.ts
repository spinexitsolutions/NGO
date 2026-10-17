import sharp from 'sharp';
import { prisma } from '../config/db.js';
import { sniff } from '../middleware/upload.js';
import { AppError } from '../utils/AppError.js';
import { storage } from './storage/index.js';
import { clearConfigCache } from './config.service.js';

const WIDTHS = [480, 960, 1600];
const MAX_DIMENSION = 2400;

interface Processed {
  buffer: Buffer;
  ext: string;
  mime: string;
  width?: number;
  height?: number;
  kind: 'IMAGE' | 'VIDEO' | 'DOCUMENT';
}

/** Validates by content, strips metadata (EXIF/GPS), resizes and converts images to WebP. */
async function processFile(buf: Buffer): Promise<{ main: Processed; variants: { width: number; buffer: Buffer }[] }> {
  const type = sniff(buf);
  if (!type) throw AppError.badRequest('Unsupported file type. Upload JPG, PNG, WebP, AVIF, GIF, MP4, WebM or PDF.');
  if (type.kind !== 'IMAGE' || type.mime === 'image/gif') return { main: { buffer: buf, ...type }, variants: [] };
  let img = sharp(buf, { failOn: 'error' }).rotate();
  const meta = await img.metadata();
  if (!meta.width || !meta.height) throw AppError.badRequest('Could not read image');
  if ((meta.width ?? 0) > MAX_DIMENSION || (meta.height ?? 0) > MAX_DIMENSION)
    img = img.resize({ width: MAX_DIMENSION, height: MAX_DIMENSION, fit: 'inside', withoutEnlargement: true });
  const { data, info } = await img.webp({ quality: 82 }).toBuffer({ resolveWithObject: true });
  const variants = await Promise.all(
    WIDTHS.filter((w) => w < info.width).map(async (width) => ({
      width,
      buffer: await sharp(data).resize({ width }).webp({ quality: 80 }).toBuffer(),
    })),
  );
  return { main: { buffer: data, ext: 'webp', mime: 'image/webp', width: info.width, height: info.height, kind: 'IMAGE' }, variants };
}

export async function storeUpload(file: Express.Multer.File, opts: { folder: string; alt?: string; userId?: string }) {
  const { main, variants } = await processFile(file.buffer);
  const stored = await storage.put(main.buffer, { folder: opts.folder, ext: main.ext, contentType: main.mime });
  const variantUrls: Record<string, string> = {};
  for (const v of variants) {
    const s = await storage.put(v.buffer, { folder: `${opts.folder}`, ext: 'webp', contentType: 'image/webp' });
    variantUrls[String(v.width)] = s.url;
  }
  const originalName = file.originalname.replace(/[^\w.\- ]+/g, '').slice(0, 120) || 'upload';
  return prisma.mediaAsset.create({
    data: {
      kind: main.kind,
      provider: stored.provider,
      storageKey: stored.key,
      url: stored.url,
      variants: variantUrls,
      folder: opts.folder,
      filename: originalName,
      mimeType: main.mime,
      size: main.buffer.length,
      width: main.width,
      height: main.height,
      alt: opts.alt ?? '',
      uploadedById: opts.userId,
    },
  });
}

/** Replaces the file behind an asset, keeping its id/alt/caption. The URL changes; references are updated. */
export async function replaceUpload(id: string, file: Express.Multer.File) {
  const asset = await prisma.mediaAsset.findUniqueOrThrow({ where: { id } });
  const { main, variants } = await processFile(file.buffer);
  const stored = await storage.put(main.buffer, { folder: asset.folder, ext: main.ext, contentType: main.mime });
  const variantUrls: Record<string, string> = {};
  for (const v of variants) variantUrls[String(v.width)] = (await storage.put(v.buffer, { folder: asset.folder, ext: 'webp', contentType: 'image/webp' })).url;
  const updated = await prisma.mediaAsset.update({
    where: { id },
    data: {
      kind: main.kind,
      provider: stored.provider,
      storageKey: stored.key,
      url: stored.url,
      variants: variantUrls,
      mimeType: main.mime,
      size: main.buffer.length,
      width: main.width,
      height: main.height,
    },
  });
  const replaced = await replaceUrlEverywhere(asset.url, stored.url);
  await removeStoredFiles(asset.storageKey, asset.variants as Record<string, string>);
  return { asset: updated, referencesUpdated: replaced };
}

export async function removeStoredFiles(key: string, variants: Record<string, string>) {
  await storage.remove(key).catch(() => undefined);
  for (const url of Object.values(variants ?? {})) {
    const m = url.match(/\/uploads\/(.+)$/);
    if (m) await storage.remove(m[1]).catch(() => undefined);
  }
}

// Models/fields that can reference media URLs (plain text, JSON documents and JSON lists).
const URL_FIELDS: { model: string; id: string; label: string; fields: string[]; history?: boolean }[] = [
  { model: 'configDocument', id: 'key', label: 'key', fields: ['draft', 'published'] },
  { model: 'page', id: 'id', label: 'slug', fields: ['draft'] },
  { model: 'pageVersion', id: 'id', label: 'pageId', fields: ['data'], history: true },
  { model: 'cause', id: 'id', label: 'title', fields: ['coverImage', 'body', 'gallery'] },
  { model: 'campaign', id: 'id', label: 'title', fields: ['coverImage', 'body', 'gallery'] },
  { model: 'project', id: 'id', label: 'title', fields: ['coverImage', 'body', 'gallery'] },
  { model: 'story', id: 'id', label: 'title', fields: ['image', 'body'] },
  { model: 'event', id: 'id', label: 'title', fields: ['coverImage', 'body', 'gallery', 'materials'] },
  { model: 'blogPost', id: 'id', label: 'title', fields: ['coverImage', 'body'] },
  { model: 'teamMember', id: 'id', label: 'name', fields: ['photo'] },
  { model: 'partner', id: 'id', label: 'name', fields: ['logo'] },
  { model: 'testimonial', id: 'id', label: 'author', fields: ['photo'] },
  { model: 'document', id: 'id', label: 'title', fields: ['fileUrl', 'coverImage'] },
  { model: 'galleryAlbum', id: 'id', label: 'title', fields: ['coverImage', 'items'] },
  { model: 'campaignUpdate', id: 'id', label: 'title', fields: ['image', 'body'] },
  { model: 'projectReport', id: 'id', label: 'title', fields: ['image', 'fileUrl', 'body'] },
  { model: 'volunteerOpportunity', id: 'id', label: 'title', fields: ['image'] },
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Delegate = { findMany: (args: unknown) => Promise<Record<string, any>[]>; update: (args: unknown) => Promise<unknown> };
const delegateFor = (model: string) => (prisma as unknown as Record<string, Delegate>)[model];

const mentions = (value: unknown, url: string) => (typeof value === 'string' ? value : JSON.stringify(value ?? '')).includes(url);

/** Finds where an asset URL is used (scans known text, JSON and list fields). */
export async function findUsage(url: string): Promise<{ table: string; id: string; label: string }[]> {
  const results: { table: string; id: string; label: string }[] = [];
  for (const t of URL_FIELDS.filter((x) => !x.history)) {
    const select = Object.fromEntries([t.id, t.label, ...t.fields].map((f) => [f, true]));
    const rows = await delegateFor(t.model).findMany({ select });
    for (const r of rows) {
      if (t.fields.some((f) => mentions(r[f], url))) results.push({ table: t.model[0].toUpperCase() + t.model.slice(1), id: String(r[t.id]), label: String(r[t.label] ?? '') });
      if (results.length > 200) return results;
    }
  }
  return results;
}

async function replaceUrlEverywhere(oldUrl: string, newUrl: string): Promise<number> {
  let count = 0;
  const swap = (value: unknown): unknown =>
    typeof value === 'string' ? value.split(oldUrl).join(newUrl) : JSON.parse(JSON.stringify(value).split(JSON.stringify(oldUrl).slice(1, -1)).join(JSON.stringify(newUrl).slice(1, -1)));
  // Published page history stays immutable.
  for (const t of URL_FIELDS.filter((x) => !x.history)) {
    const select = Object.fromEntries([t.id, ...t.fields].map((f) => [f, true]));
    const rows = await delegateFor(t.model).findMany({ select });
    for (const r of rows) {
      const changed = Object.fromEntries(t.fields.filter((f) => mentions(r[f], oldUrl)).map((f) => [f, swap(r[f])]));
      if (!Object.keys(changed).length) continue;
      await delegateFor(t.model).update({ where: { [t.id]: r[t.id] }, data: changed });
      count++;
    }
  }
  clearConfigCache();
  return count;
}
