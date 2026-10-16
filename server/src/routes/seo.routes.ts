import { Router } from 'express';
import { env } from '../config/env.js';
import { prisma } from '../config/db.js';
import { asyncHandler } from '../utils/http.js';

export const seoRouter = Router();

const esc = (s: string) => s.replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c]!);

seoRouter.get('/robots.txt', (_req, res) => {
  res.type('text/plain').send(`User-agent: *\nDisallow: /admin\nDisallow: /api/\nDisallow: /donor\nAllow: /\n\nSitemap: ${env.PUBLIC_SITE_URL}/sitemap.xml\n`);
});

seoRouter.get(
  '/sitemap.xml',
  asyncHandler(async (_req, res) => {
    const base = env.PUBLIC_SITE_URL.replace(/\/$/, '');
    const [pages, causes, campaigns, projects, stories, posts, events, albums] = await Promise.all([
      prisma.page.findMany({ where: { publishedVersionId: { not: null }, showInSitemap: true }, select: { slug: true, updatedAt: true } }),
      prisma.cause.findMany({ where: { status: 'PUBLISHED' }, select: { slug: true, updatedAt: true } }),
      prisma.campaign.findMany({ where: { status: { in: ['ACTIVE', 'COMPLETED'] } }, select: { slug: true, updatedAt: true } }),
      prisma.project.findMany({ where: { status: 'PUBLISHED' }, select: { slug: true, updatedAt: true } }),
      prisma.story.findMany({ where: { status: 'PUBLISHED', consentObtained: true }, select: { slug: true, updatedAt: true } }),
      prisma.blogPost.findMany({ where: { status: 'PUBLISHED', publishedAt: { lte: new Date() } }, select: { slug: true, updatedAt: true } }),
      prisma.event.findMany({ where: { status: 'PUBLISHED' }, select: { slug: true, updatedAt: true } }),
      prisma.galleryAlbum.findMany({ where: { status: 'PUBLISHED' }, select: { slug: true, updatedAt: true } }),
    ]);
    const urls = [
      ...pages.map((p) => ({ loc: p.slug === 'home' ? '/' : `/${p.slug}`, mod: p.updatedAt })),
      ...['/causes', '/campaigns', '/projects', '/stories', '/blog', '/events', '/gallery', '/donate', '/volunteer'].map((loc) => ({ loc, mod: new Date() })),
      ...causes.map((x) => ({ loc: `/causes/${x.slug}`, mod: x.updatedAt })),
      ...campaigns.map((x) => ({ loc: `/campaigns/${x.slug}`, mod: x.updatedAt })),
      ...projects.map((x) => ({ loc: `/projects/${x.slug}`, mod: x.updatedAt })),
      ...stories.map((x) => ({ loc: `/stories/${x.slug}`, mod: x.updatedAt })),
      ...posts.map((x) => ({ loc: `/blog/${x.slug}`, mod: x.updatedAt })),
      ...events.map((x) => ({ loc: `/events/${x.slug}`, mod: x.updatedAt })),
      ...albums.map((x) => ({ loc: `/gallery/${x.slug}`, mod: x.updatedAt })),
    ];
    const unique = [...new Map(urls.map((u) => [u.loc, u])).values()];
    res
      .type('application/xml')
      .send(
        `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${unique
          .map((u) => `  <url><loc>${esc(base + u.loc)}</loc><lastmod>${u.mod.toISOString().slice(0, 10)}</lastmod></url>`)
          .join('\n')}\n</urlset>\n`,
      );
  }),
);
