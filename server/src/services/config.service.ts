import type { Prisma } from '@prisma/client';
import {
  DEFAULT_NAVIGATION,
  DEFAULT_SETTINGS,
  DEFAULT_THEME,
  navigationSchema,
  settingsSchema,
  themeSchema,
  type Navigation,
  type SiteSettings,
  type Theme,
} from '@ngo/shared';
import type { ZodTypeAny } from 'zod';
import { prisma } from '../config/db.js';

export type ConfigKey = 'theme' | 'settings' | 'navigation';
type ConfigValue = { theme: Theme; settings: SiteSettings; navigation: Navigation };

export const CONFIG: { [K in ConfigKey]: { schema: ZodTypeAny; defaults: ConfigValue[K] } } = {
  theme: { schema: themeSchema, defaults: DEFAULT_THEME },
  settings: { schema: settingsSchema, defaults: DEFAULT_SETTINGS },
  navigation: { schema: navigationSchema, defaults: DEFAULT_NAVIGATION },
};

export function isConfigKey(k: string): k is ConfigKey {
  return k === 'theme' || k === 'settings' || k === 'navigation';
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Deep-merges stored values over defaults so newly added settings always have a value. Arrays replace. */
export function deepMerge<T>(defaults: T, stored: unknown): T {
  if (!isPlainObject(defaults) || !isPlainObject(stored)) return (stored === undefined ? defaults : stored) as T;
  const out: Record<string, unknown> = { ...defaults };
  for (const [k, v] of Object.entries(stored)) {
    out[k] = k in defaults ? deepMerge((defaults as Record<string, unknown>)[k], v) : v;
  }
  return out as T;
}

/** Normalises a stored document; falls back to defaults if it no longer validates. */
function normalise<K extends ConfigKey>(key: K, stored: unknown): ConfigValue[K] {
  const { schema, defaults } = CONFIG[key];
  const r = schema.safeParse(deepMerge(defaults, stored));
  return (r.success ? r.data : defaults) as ConfigValue[K];
}

const cache = new Map<ConfigKey, unknown>();
export function clearConfigCache() {
  cache.clear();
}

async function ensure(key: ConfigKey) {
  const existing = await prisma.configDocument.findUnique({ where: { key } });
  if (existing) return existing;
  const defaults = CONFIG[key].defaults as Prisma.InputJsonValue;
  return prisma.configDocument.upsert({
    where: { key },
    create: { key, draft: defaults, published: defaults, versions: { create: { version: 1, data: defaults, note: 'Initial defaults' } } },
    update: {},
  });
}

export async function getPublished<K extends ConfigKey>(key: K): Promise<ConfigValue[K]> {
  if (cache.has(key)) return cache.get(key) as ConfigValue[K];
  const doc = await ensure(key);
  const value = normalise(key, doc.published);
  cache.set(key, value);
  return value;
}

export async function getDraft<K extends ConfigKey>(key: K) {
  const doc = await ensure(key);
  return {
    draft: normalise(key, doc.draft),
    published: normalise(key, doc.published),
    version: doc.version,
    draftUpdatedAt: doc.draftUpdatedAt,
    publishedAt: doc.publishedAt,
    hasUnpublishedChanges: JSON.stringify(doc.draft) !== JSON.stringify(doc.published),
  };
}

export async function saveDraft<K extends ConfigKey>(key: K, value: ConfigValue[K], userId?: string) {
  await ensure(key);
  return prisma.configDocument.update({
    where: { key },
    data: { draft: value as Prisma.InputJsonValue, draftUpdatedAt: new Date(), updatedById: userId },
  });
}

export async function bumpContentVersion(): Promise<number> {
  const c = await prisma.counter.upsert({ where: { key: 'content' }, create: { key: 'content', value: 1 }, update: { value: { increment: 1 } } });
  return c.value;
}

export async function contentVersion(): Promise<number> {
  const c = await prisma.counter.findUnique({ where: { key: 'content' } });
  return c?.value ?? 0;
}

export async function publish(key: ConfigKey, note: string, userId?: string) {
  const doc = await ensure(key);
  const value = normalise(key, doc.draft) as Prisma.InputJsonValue;
  const version = doc.version + 1;
  const updated = await prisma.$transaction(async (tx) => {
    await tx.configVersion.create({ data: { key, version, data: value, note, createdById: userId } });
    return tx.configDocument.update({
      where: { key },
      data: { published: value, draft: value, version, publishedAt: new Date(), updatedById: userId },
    });
  });
  cache.delete(key);
  await bumpContentVersion();
  return updated;
}

export async function listVersions(key: ConfigKey) {
  return prisma.configVersion.findMany({
    where: { key },
    orderBy: { version: 'desc' },
    take: 30,
    select: { id: true, version: true, note: true, createdAt: true, createdById: true },
  });
}

/** Copies a previous published version into the draft (it must then be published). */
export async function restoreVersion(key: ConfigKey, versionId: string, userId?: string) {
  const v = await prisma.configVersion.findFirst({ where: { id: versionId, key } });
  if (!v) return null;
  await saveDraft(key, normalise(key, v.data), userId);
  return v;
}
