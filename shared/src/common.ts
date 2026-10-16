import { z } from 'zod';

export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const slugSchema = z.string().trim().min(1).max(120).regex(SLUG_RE, 'Use lowercase letters, numbers and hyphens');

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}

/** Internal path ("/donate") or absolute http(s)/mailto/tel URL. Blocks javascript: and other schemes. */
export const linkSchema = z
  .string()
  .trim()
  .max(500)
  .refine(
    (v) => v === '' || v.startsWith('/') || v.startsWith('#') || /^(https?:\/\/|mailto:|tel:)/i.test(v),
    'Use a path starting with "/" or a full https:// URL',
  );

/** Image/media URL: uploaded asset path or absolute https URL. */
export const mediaUrlSchema = z
  .string()
  .trim()
  .max(1000)
  .refine((v) => v === '' || v.startsWith('/') || /^https?:\/\//i.test(v), 'Choose an image from the media library or use an https:// URL');

export const colorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Use a hex colour like #164B3A');

export const seoSchema = z
  .object({
    title: z.string().max(70).optional().default(''),
    description: z.string().max(170).optional().default(''),
    image: mediaUrlSchema.optional().default(''),
    noIndex: z.boolean().optional().default(false),
  })
  .default({});
export type Seo = z.infer<typeof seoSchema>;

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().trim().max(200).optional(),
});

export interface Paginated<T> {
  data: T[];
  meta: { page: number; limit: number; total: number; pages: number };
}
