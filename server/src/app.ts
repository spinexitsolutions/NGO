import fs from 'node:fs';
import path from 'node:path';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import express from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { loadSession } from './middleware/auth.js';
import { csrf } from './middleware/csrf.js';
import { errorHandler, notFound } from './middleware/error.js';
import { apiLimiter } from './middleware/rateLimit.js';
import { collectionsRouter } from './routes/admin/collections.routes.js';
import { configRouter } from './routes/admin/config.routes.js';
import { adminDonationsRouter, adminDonorsRouter } from './routes/admin/donations.routes.js';
import { mediaRouter } from './routes/admin/media.routes.js';
import {
  adminBeneficiariesRouter,
  adminEventsRouter,
  adminInquiriesRouter,
  adminSubscribersRouter,
  emailRouter,
  notesRouter,
} from './routes/admin/operations.routes.js';
import { pagesRouter, sectionTemplatesRouter } from './routes/admin/pages.routes.js';
import { auditRouter, dashboardRouter, notificationsRouter, reportsRouter, rolesRouter, usersRouter } from './routes/admin/system.routes.js';
import { adminVolunteersRouter } from './routes/admin/volunteers.routes.js';
import { authRouter } from './routes/auth.routes.js';
import { donationsRouter, donorRouter, webhookRouter } from './routes/donations.routes.js';
import { formsRouter } from './routes/forms.routes.js';
import { publicRouter } from './routes/public.routes.js';
import { seoRouter } from './routes/seo.routes.js';
import { PUBLIC_UPLOAD_DIR } from './services/storage/index.js';

export function createApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          'script-src': ["'self'", 'https://checkout.razorpay.com', 'https://www.googletagmanager.com', 'https://plausible.io'],
          'img-src': ["'self'", 'data:', 'blob:', 'https:'],
          'media-src': ["'self'", 'https:'],
          'font-src': ["'self'", 'https://fonts.gstatic.com', 'data:'],
          'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          'frame-src': ['https://api.razorpay.com', 'https://checkout.razorpay.com', 'https://www.youtube-nocookie.com', 'https://www.youtube.com', 'https://player.vimeo.com', 'https://www.google.com', 'https://www.openstreetmap.org'],
          'connect-src': ["'self'", 'https://lumberjack.razorpay.com', 'https://api.razorpay.com', 'https://www.google-analytics.com', 'https://plausible.io'],
        },
      },
      crossOriginEmbedderPolicy: false,
    }),
  );
  app.use(compression());
  if (env.NODE_ENV !== 'test') app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => req.url?.startsWith('/uploads') ?? false } }));

  // Webhooks need the raw body for signature verification, so they are mounted before JSON parsing and CSRF.
  app.use('/api/v1/webhooks', webhookRouter);

  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: false, limit: '1mb' }));
  app.use(cookieParser());

  app.get('/api/health', (_req, res) => res.json({ ok: true }));
  app.use(seoRouter);
  app.use('/uploads', express.static(PUBLIC_UPLOAD_DIR, { maxAge: '30d', immutable: true, fallthrough: false }));

  const api = express.Router();
  api.use(apiLimiter);
  api.use(csrf);
  api.use(loadSession);
  api.use('/auth', authRouter);
  api.use('/public', publicRouter);
  api.use('/forms', formsRouter);
  api.use('/donations', donationsRouter);
  api.use('/donor', donorRouter);

  // Admin (every route enforces authentication + permissions server-side)
  api.use('/admin/config', configRouter);
  api.use('/admin/pages', pagesRouter);
  api.use('/admin/section-templates', sectionTemplatesRouter);
  api.use('/admin/collections', collectionsRouter);
  api.use('/admin/media', mediaRouter);
  api.use('/admin/donations', adminDonationsRouter);
  api.use('/admin/donors', adminDonorsRouter);
  api.use('/admin/volunteers', adminVolunteersRouter);
  api.use('/admin/events', adminEventsRouter);
  api.use('/admin/beneficiaries', adminBeneficiariesRouter);
  api.use('/admin/inquiries', adminInquiriesRouter);
  api.use('/admin/subscribers', adminSubscribersRouter);
  api.use('/admin/notes', notesRouter);
  api.use('/admin/email', emailRouter);
  api.use('/admin/users', usersRouter);
  api.use('/admin/roles', rolesRouter);
  api.use('/admin/dashboard', dashboardRouter);
  api.use('/admin/reports', reportsRouter);
  api.use('/admin/audit', auditRouter);
  api.use('/admin/notifications', notificationsRouter);
  api.use(notFound);
  app.use('/api/v1', api);

  // Production: serve the built client (single origin => cookies + CSRF just work).
  const clientDist = path.resolve(process.cwd(), '../client/dist');
  if (env.NODE_ENV === 'production' && fs.existsSync(clientDist)) {
    app.use(express.static(clientDist, { maxAge: '1y', index: false, setHeaders: (res, p) => p.endsWith('.html') && res.setHeader('Cache-Control', 'no-cache') }));
    app.get('*', (_req, res) => res.sendFile(path.join(clientDist, 'index.html'), { headers: { 'Cache-Control': 'no-cache' } }));
  }

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
