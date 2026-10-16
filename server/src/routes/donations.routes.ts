import express, { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { donationCheckoutSchema } from '@ngo/shared';
import { prisma } from '../config/db.js';
import { env, isProd } from '../config/env.js';
import { logger } from '../config/logger.js';
import { checkoutLimiter, formLimiter } from '../middleware/rateLimit.js';
import { createCheckout, handleWebhook, markFailed, verifyCheckout } from '../services/donation.service.js';
import { sendTemplate } from '../services/email.service.js';
import { providerFor } from '../services/payments/index.js';
import { verifyRazorpayWebhook } from '../services/payments/razorpay.provider.js';
import { sandboxSign } from '../services/payments/sandbox.provider.js';
import { receiptPdf } from '../services/receipt.service.js';
import { AppError } from '../utils/AppError.js';
import { hmacSha256Hex, randomToken, safeEqual, sha256 } from '../utils/crypto.js';
import { asyncHandler, parse } from '../utils/http.js';

export const donationsRouter = Router();

donationsRouter.post(
  '/checkout',
  checkoutLimiter,
  asyncHandler(async (req, res) => {
    const input = parse(donationCheckoutSchema, req.body);
    res.status(201).json({ data: await createCheckout(input) });
  }),
);

donationsRouter.post(
  '/verify',
  checkoutLimiter,
  asyncHandler(async (req, res) => {
    const input = parse(
      z.object({
        reference: z.string().max(40),
        paymentId: z.string().min(3).max(100),
        signature: z.string().min(10).max(200),
        orderId: z.string().max(100).optional(),
        subscriptionId: z.string().max(100).optional(),
      }),
      req.body,
    );
    const d = await verifyCheckout(input);
    res.json({ data: { reference: d.reference, status: d.status } });
  }),
);

/** Browser reports a failed/cancelled checkout. Only a PENDING donation can become FAILED. */
donationsRouter.post(
  '/failed',
  checkoutLimiter,
  asyncHandler(async (req, res) => {
    const { reference, reason } = parse(z.object({ reference: z.string().max(40), reason: z.string().max(300).default('Payment was not completed') }), req.body);
    const d = await prisma.donation.findUnique({ where: { reference } });
    if (!d) throw AppError.notFound();
    await markFailed(d.id, reason, undefined, false);
    res.json({ data: { ok: true } });
  }),
);

/** Minimal public status for the thank-you page (no personal data). */
donationsRouter.get(
  '/:reference/status',
  asyncHandler(async (req, res) => {
    const d = await prisma.donation.findUnique({
      where: { reference: req.params.reference },
      select: { reference: true, status: true, amount: true, currency: true, frequency: true, paidAt: true, campaign: { select: { title: true, slug: true } }, cause: { select: { title: true } } },
    });
    if (!d) throw AppError.notFound();
    res.set('Cache-Control', 'no-store').json({ data: d });
  }),
);

/** Sandbox gateway simulator — signs a fake payment exactly like the real gateway. Disabled in production. */
donationsRouter.post(
  '/sandbox/authorize',
  checkoutLimiter,
  asyncHandler(async (req, res) => {
    if (env.PAYMENT_PROVIDER !== 'sandbox' || isProd) throw AppError.notFound();
    const { reference, outcome } = parse(z.object({ reference: z.string().max(40), outcome: z.enum(['success', 'failure']) }), req.body);
    const d = await prisma.donation.findUnique({ where: { reference }, include: { recurring: true } });
    if (!d || d.provider !== 'sandbox' || d.status !== 'PENDING') throw AppError.badRequest('Nothing to authorise');
    if (outcome === 'failure') {
      await markFailed(d.id, 'Payment declined (sandbox simulation)');
      return res.json({ data: { failed: true } });
    }
    const paymentId = `pay_sbx_${randomToken(10)}`;
    const subscriptionId = d.recurring?.providerSubscriptionId;
    const signature = sandboxSign(subscriptionId ? `${paymentId}|${subscriptionId}` : `${d.providerOrderId}|${paymentId}`);
    res.json({ data: { paymentId, signature, orderId: d.providerOrderId ?? undefined, subscriptionId } });
  }),
);

// ─── Webhooks (raw body for signature verification; mounted before JSON parsing) ──

export const webhookRouter = Router();
webhookRouter.post(
  '/razorpay',
  express.raw({ type: 'application/json', limit: '1mb' }),
  asyncHandler(async (req: Request, res: Response) => {
    const raw = req.body as Buffer;
    if (!Buffer.isBuffer(raw) || !verifyRazorpayWebhook(raw, req.get('x-razorpay-signature'))) {
      logger.warn('Rejected webhook with invalid signature');
      throw new AppError(400, 'INVALID_SIGNATURE', 'Invalid signature');
    }
    const body = JSON.parse(raw.toString('utf8'));
    // Razorpay sends a unique id per event; fall back to a hash of the body for safety.
    const eventId = req.get('x-razorpay-event-id') ?? sha256(raw.toString('utf8'));
    const result = await handleWebhook('razorpay', eventId, body);
    res.json({ data: result });
  }),
);

// ─── Donor portal (passwordless) ─────────────────────────────────────────────────

const DONOR_COOKIE = 'ngo_donor';
const DONOR_SESSION_MS = 2 * 60 * 60 * 1000;

function signDonor(donorId: string): string {
  const payload = `${donorId}.${Date.now() + DONOR_SESSION_MS}`;
  return `${payload}.${hmacSha256Hex(env.APP_SECRET, `donor:${payload}`)}`;
}
function readDonor(req: Request): string | null {
  const v = req.cookies?.[DONOR_COOKIE];
  if (typeof v !== 'string') return null;
  const [id, exp, sig] = v.split('.');
  if (!id || !exp || !sig || Number(exp) < Date.now()) return null;
  return safeEqual(hmacSha256Hex(env.APP_SECRET, `donor:${id}.${exp}`), sig) ? id : null;
}
function requireDonor(req: Request): string {
  const id = readDonor(req);
  if (!id) throw AppError.unauthorized('Please sign in to the donor portal');
  return id;
}

export const donorRouter = Router();

donorRouter.post(
  '/login',
  formLimiter,
  asyncHandler(async (req, res) => {
    const { email } = parse(z.object({ email: z.string().trim().toLowerCase().email() }), req.body);
    const donor = await prisma.donor.findUnique({ where: { email } });
    if (donor) {
      const token = randomToken(32);
      await prisma.donorLoginToken.create({ data: { tokenHash: sha256(token), donorId: donor.id, expiresAt: new Date(Date.now() + 30 * 60_000) } });
      await sendTemplate({ to: donor.email, template: 'donor_login', vars: { donorName: donor.name, loginUrl: `${env.PUBLIC_SITE_URL}/donor?token=${token}` }, related: { type: 'Donor', id: donor.id } });
    }
    res.json({ data: { ok: true } }); // same response whether or not the email is known
  }),
);

donorRouter.post(
  '/session',
  formLimiter,
  asyncHandler(async (req, res) => {
    const { token } = parse(z.object({ token: z.string().min(20).max(100) }), req.body);
    const t = await prisma.donorLoginToken.findUnique({ where: { tokenHash: sha256(token) } });
    if (!t || t.usedAt || t.expiresAt < new Date()) throw AppError.badRequest('This sign-in link is invalid or has expired');
    await prisma.donorLoginToken.update({ where: { id: t.id }, data: { usedAt: new Date() } });
    res.cookie(DONOR_COOKIE, signDonor(t.donorId), { httpOnly: true, secure: env.COOKIE_SECURE, sameSite: 'lax', maxAge: DONOR_SESSION_MS, path: '/' });
    res.json({ data: { ok: true } });
  }),
);

donorRouter.post('/logout', (_req, res) => {
  res.clearCookie(DONOR_COOKIE, { path: '/' });
  res.json({ data: { ok: true } });
});

donorRouter.get(
  '/me',
  asyncHandler(async (req, res) => {
    const donorId = requireDonor(req);
    const donor = await prisma.donor.findUniqueOrThrow({
      where: { id: donorId },
      select: {
        name: true,
        email: true,
        phone: true,
        marketingOptIn: true,
        donations: {
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            reference: true,
            amount: true,
            refundedAmount: true,
            currency: true,
            status: true,
            frequency: true,
            paidAt: true,
            createdAt: true,
            campaign: { select: { title: true, slug: true } },
            cause: { select: { title: true } },
            receipts: { where: { status: 'ISSUED' }, select: { id: true, receiptNumber: true } },
          },
        },
        recurring: { select: { id: true, reference: true, amount: true, currency: true, status: true, createdAt: true, campaign: { select: { title: true } } } },
      },
    });
    res.set('Cache-Control', 'no-store').json({ data: donor });
  }),
);

donorRouter.get(
  '/receipts/:id/pdf',
  asyncHandler(async (req, res) => {
    const donorId = requireDonor(req);
    const receipt = await prisma.receipt.findUnique({ where: { id: req.params.id }, include: { donation: { select: { donorId: true } } } });
    if (!receipt || receipt.donation.donorId !== donorId) throw AppError.notFound();
    const pdf = await receiptPdf(receipt.id);
    res.type('application/pdf').attachment(`receipt-${receipt.receiptNumber.replace(/\//g, '-')}.pdf`).send(pdf);
  }),
);

donorRouter.put(
  '/preferences',
  asyncHandler(async (req, res) => {
    const donorId = requireDonor(req);
    const { marketingOptIn } = parse(z.object({ marketingOptIn: z.boolean() }), req.body);
    await prisma.donor.update({ where: { id: donorId }, data: { marketingOptIn, marketingConsentAt: marketingOptIn ? new Date() : null } });
    res.json({ data: { ok: true } });
  }),
);

donorRouter.post(
  '/recurring/:id/cancel',
  asyncHandler(async (req, res) => {
    const donorId = requireDonor(req);
    const r = await prisma.recurringDonation.findUnique({ where: { id: req.params.id } });
    if (!r || r.donorId !== donorId) throw AppError.notFound();
    if (!['CREATED', 'ACTIVE'].includes(r.status)) throw AppError.badRequest('This monthly gift is not active');
    await providerFor(r.provider).cancelSubscription(r.providerSubscriptionId);
    await prisma.recurringDonation.update({ where: { id: r.id }, data: { status: 'CANCELLED' } });
    res.json({ data: { ok: true } });
  }),
);

/** Data portability: everything we hold about this donor, as JSON. */
donorRouter.get(
  '/export',
  asyncHandler(async (req, res) => {
    const donorId = requireDonor(req);
    const donor = await prisma.donor.findUniqueOrThrow({
      where: { id: donorId },
      include: { donations: { include: { receipts: { select: { receiptNumber: true, status: true, issuedAt: true } } } }, recurring: true },
    });
    res.attachment('my-donor-data.json').json({ exportedAt: new Date().toISOString(), donor });
  }),
);
