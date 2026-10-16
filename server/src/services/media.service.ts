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

// Tables/columns that can reference media URLs (text and JSON).
const URL_COLUMNS: { table: string; columns: string[]; json?: string[]; arrays?: string[] }[] = [
  { table: 'ConfigDocument', columns: [], json: ['draft', 'published'] },
  { table: 'Page', columns: [], json: ['draft'] },
  { table: 'PageVersion', columns: [], json: ['data'] },
  { table: 'Cause', columns: ['coverImage', 'body'], arrays: ['gallery'] },
  { table: 'Campaign', columns: ['coverImage', 'body'], arrays: ['gallery'] },
  { table: 'Project', columns: ['coverImage', 'body'], arrays: ['gallery'] },
  { table: 'Story', columns: ['image', 'body'] },
  { table: 'Event', columns: ['coverImage', 'body'], arrays: ['gallery'], json: ['materials'] },
  { table: 'BlogPost', columns: ['coverImage', 'body'] },
  { table: 'TeamMember', columns: ['photo'] },
  { table: 'Partner', columns: ['logo'] },
  { table: 'Testimonial', columns: ['photo'] },
  { table: 'Document', columns: ['fileUrl', 'coverImage'] },
  { table: 'GalleryAlbum', columns: ['coverImage'], json: ['items'] },
  { table: 'CampaignUpdate', columns: ['image', 'body'] },
  { table: 'ProjectReport', columns: ['image', 'fileUrl', 'body'] },
  { table: 'VolunteerOpportunity', columns: ['image'] },
];

/** Finds where an asset URL is used (best effort: scans known columns, JSON documents and arrays). */
export async function findUsage(url: string): Promise<{ table: string; id: string; label: string }[]> {
  const results: { table: string; id: string; label: string }[] = [];
  for (const t of URL_COLUMNS) {
    const conds = [
      ...t.columns.map((c) => `"${c}" LIKE '%' || $1 || '%'`),
      ...(t.json ?? []).map((c) => `"${c}"::text LIKE '%' || $1 || '%'`),
      ...(t.arrays ?? []).map((c) => `$1 = ANY("${c}")`),
    ];
    if (!conds.length) continue;
    const idCol = t.table === 'ConfigDocument' ? 'key' : 'id';
    const labelCol =
      t.table === 'ConfigDocument' ? '"key"' : t.table === 'Page' ? '"slug"' : t.table === 'PageVersion' ? '"pageId"' : ['TeamMember', 'Partner'].includes(t.table) ? '"name"' : t.table === 'Testimonial' ? '"author"' : '"title"';
    const rows = await prisma.$queryRawUnsafe<{ id: string; label: string }[]>(
      `SELECT "${idCol}" AS id, ${labelCol}::text AS label FROM "${t.table}" WHERE ${conds.join(' OR ')} LIMIT 20`,
      url,
    );
    rows.forEach((r) => results.push({ table: t.table, id: r.id, label: r.label }));
  }
  return results.filter((r) => r.table !== 'PageVersion');
}

async function replaceUrlEverywhere(oldUrl: string, newUrl: string): Promise<number> {
  let count = 0;
  for (const t of URL_COLUMNS) {
    if (t.table === 'PageVersion') continue; // published history stays immutable
    for (const c of t.columns) {
      count += await prisma.$executeRawUnsafe(`UPDATE "${t.table}" SET "${c}" = replace("${c}", $1, $2) WHERE "${c}" LIKE '%' || $1 || '%'`, oldUrl, newUrl);
    }
    for (const c of t.json ?? []) {
      count += await prisma.$executeRawUnsafe(
        `UPDATE "${t.table}" SET "${c}" = replace("${c}"::text, $1, $2)::jsonb WHERE "${c}"::text LIKE '%' || $1 || '%'`,
        JSON.stringify(oldUrl).slice(1, -1),
        JSON.stringify(newUrl).slice(1, -1),
      );
    }
    for (const c of t.arrays ?? []) {
      count += await prisma.$executeRawUnsafe(`UPDATE "${t.table}" SET "${c}" = array_replace("${c}", $1, $2) WHERE $1 = ANY("${c}")`, oldUrl, newUrl);
    }
  }
  clearConfigCache();
  return count;
}
