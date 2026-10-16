import { Router } from 'express';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../../config/db.js';
import { hasPermission, requirePermission } from '../../middleware/auth.js';
import { audit } from '../../services/audit.service.js';
import { emailReceipt, recordOfflineDonation, refundDonation } from '../../services/donation.service.js';
import { providerFor } from '../../services/payments/index.js';
import { issueReceipt, receiptPdf, voidReceipt } from '../../services/receipt.service.js';
import { AppError } from '../../utils/AppError.js';
import { toCsv } from '../../utils/csv.js';
import { asyncHandler, pageMeta, parse } from '../../utils/http.js';

export const adminDonationsRouter = Router();

const listQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  q: z.string().trim().max(200).optional(),
  status: z.enum(['PENDING', 'SUCCESS', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED', 'CANCELLED']).optional(),
  method: z.enum(['ONLINE', 'BANK_TRANSFER', 'UPI', 'CHEQUE', 'CASH', 'OTHER']).optional(),
  campaignId: z.string().optional(),
  causeId: z.string().optional(),
  frequency: z.enum(['ONE_TIME', 'MONTHLY']).optional(),
  from: z.string().date().optional(),
  to: z.string().date().optional(),
  includeSample: z.enum(['true', 'false']).default('true'),
  format: z.enum(['json', 'csv']).default('json'),
});

function donationWhere(q: z.infer<typeof listQuery>): Prisma.DonationWhereInput {
  const where: Prisma.DonationWhereInput = {};
  if (q.status) where.status = q.status;
  if (q.method) where.method = q.method;
  if (q.campaignId) where.campaignId = q.campaignId;
  if (q.causeId) where.causeId = q.causeId;
  if (q.frequency) where.frequency = q.frequency;
  if (q.includeSample === 'false') where.isSample = false;
  if (q.from || q.to) where.createdAt = { ...(q.from ? { gte: new Date(q.from) } : {}), ...(q.to ? { lt: new Date(new Date(q.to).getTime() + 86_400_000) } : {}) };
  if (q.q)
    where.OR = [
      { reference: { contains: q.q, mode: 'insensitive' } },
      { providerPaymentId: { contains: q.q } },
      { offlineReference: { contains: q.q, mode: 'insensitive' } },
      { donor: { email: { contains: q.q, mode: 'insensitive' } } },
      { donor: { name: { contains: q.q, mode: 'insensitive' } } },
      { campaign: { title: { contains: q.q, mode: 'insensitive' } } },
    ];
  return where;
}

adminDonationsRouter.get(
  '/',
  requirePermission('donations.view'),
  asyncHandler(async (req, res) => {
    const q = parse(listQuery, req.query);
    const where = donationWhere(q);
    const include = { donor: { select: { name: true, email: true, phone: true } }, campaign: { select: { title: true } }, cause: { select: { title: true } }, receipts: { where: { status: 'ISSUED' as const }, select: { receiptNumber: true } } };
    if (q.format === 'csv') {
      if (!hasPermission(req.user, 'donations.export')) throw AppError.forbidden('Exporting donations requires the export permission');
      const rows = await prisma.donation.findMany({ where, include, orderBy: { createdAt: 'desc' }, take: 50000 });
      await audit(req, { action: 'donations.exported', entityType: 'Donation', summary: `${rows.length} rows` });
      res.type('text/csv').attachment('donations.csv');
      return res.send(
        toCsv(
          rows.map((d) => ({
            reference: d.reference,
            date: d.paidAt ?? d.createdAt,
            status: d.status,
            amount: (d.amount / 100).toFixed(2),
            refunded: (d.refundedAmount / 100).toFixed(2),
            currency: d.currency,
            frequency: d.frequency,
            method: d.method,
            donor: d.donor.name,
            email: d.donor.email,
            phone: d.donor.phone,
            anonymous: d.isAnonymous ? 'yes' : 'no',
            campaign: d.campaign?.title ?? '',
            cause: d.cause?.title ?? '',
            receipt: d.receipts[0]?.receiptNumber ?? '',
            paymentId: d.providerPaymentId ?? d.offlineReference,
            utmSource: d.utmSource,
            utmCampaign: d.utmCampaign,
            sample: d.isSample ? 'yes' : 'no',
          })),
          ['reference', 'date', 'status', 'amount', 'refunded', 'currency', 'frequency', 'method', 'donor', 'email', 'phone', 'anonymous', 'campaign', 'cause', 'receipt', 'paymentId', 'utmSource', 'utmCampaign', 'sample'].map((k) => ({ key: k, label: k })),
        ),
      );
    }
    const [data, total, byStatus] = await Promise.all([
      prisma.donation.findMany({ where, include, orderBy: { createdAt: 'desc' }, skip: (q.page - 1) * q.limit, take: q.limit }),
      prisma.donation.count({ where }),
      prisma.donation.groupBy({ by: ['status'], where, _sum: { amount: true, refundedAmount: true }, _count: true }),
    ]);
    res.json({ data, meta: { ...pageMeta(q.page, q.limit, total), summary: byStatus.map((s) => ({ status: s.status, count: s._count, amount: s._sum.amount ?? 0, refunded: s._sum.refundedAmount ?? 0 })) } });
  }),
);

adminDonationsRouter.get(
  '/recurring/list',
  requirePermission('donations.view'),
  asyncHandler(async (_req, res) => {
    const data = await prisma.recurringDonation.findMany({
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: { donor: { select: { name: true, email: true } }, campaign: { select: { title: true } }, _count: { select: { donations: { where: { status: 'SUCCESS' } } } } },
    });
    res.json({ data });
  }),
);

adminDonationsRouter.post(
  '/recurring/:id/cancel',
  requirePermission('donations.manage'),
  asyncHandler(async (req, res) => {
    const r = await prisma.recurringDonation.findUniqueOrThrow({ where: { id: req.params.id } });
    if (!['CREATED', 'ACTIVE'].includes(r.status)) throw AppError.badRequest('Not active');
    await providerFor(r.provider).cancelSubscription(r.providerSubscriptionId);
    await prisma.recurringDonation.update({ where: { id: r.id }, data: { status: 'CANCELLED' } });
    await audit(req, { action: 'recurring.cancelled', entityType: 'RecurringDonation', entityId: r.id, summary: r.reference });
    res.json({ data: { ok: true } });
  }),
);

adminDonationsRouter.get(
  '/:id',
  requirePermission('donations.view'),
  asyncHandler(async (req, res) => {
    const d = await prisma.donation.findUnique({
      where: { id: req.params.id },
      include: {
        donor: true,
        campaign: { select: { id: true, title: true } },
        cause: { select: { id: true, title: true } },
        event: { select: { id: true, title: true } },
        transactions: { orderBy: { createdAt: 'asc' } },
        refunds: { orderBy: { createdAt: 'desc' } },
        receipts: { orderBy: { issuedAt: 'desc' } },
        recurring: true,
      },
    });
    if (!d) throw AppError.notFound();
    const notes = await prisma.internalNote.findMany({ where: { entityType: 'Donation', entityId: d.id }, include: { author: { select: { name: true } } }, orderBy: { createdAt: 'desc' } });
    res.json({ data: { ...d, notes } });
  }),
);

adminDonationsRouter.post(
  '/offline',
  requirePermission('donations.manage'),
  asyncHandler(async (req, res) => {
    const input = parse(
      z.object({
        name: z.string().trim().min(2).max(100),
        email: z.string().trim().email(),
        phone: z.string().trim().max(20).default(''),
        amount: z.number().int().positive().max(10_000_000_000),
        method: z.enum(['BANK_TRANSFER', 'UPI', 'CHEQUE', 'CASH', 'OTHER']),
        offlineReference: z.string().trim().min(1, 'Add the bank/UPI/cheque reference').max(100),
        receivedAt: z.string().date(),
        campaignId: z.string().nullable().optional(),
        causeId: z.string().nullable().optional(),
        notes: z.string().max(500).default(''),
        issueReceipt: z.boolean().default(true),
        isAnonymous: z.boolean().default(false),
      }),
      req.body,
    );
    if (new Date(input.receivedAt) > new Date()) throw AppError.validation('Date cannot be in the future', [{ path: 'receivedAt', message: 'Date cannot be in the future' }]);
    const d = await recordOfflineDonation(req, input);
    res.status(201).json({ data: d });
  }),
);

adminDonationsRouter.post(
  '/:id/refund',
  requirePermission('donations.manage'),
  asyncHandler(async (req, res) => {
    const { amount, reason } = parse(z.object({ amount: z.number().int().positive(), reason: z.string().trim().min(3).max(300), confirm: z.literal(true) }), req.body);
    res.json({ data: await refundDonation(req, req.params.id, amount, reason) });
  }),
);

adminDonationsRouter.post(
  '/:id/receipt',
  requirePermission('donations.manage'),
  asyncHandler(async (req, res) => {
    const receipt = await issueReceipt(req.params.id);
    await audit(req, { action: 'receipt.issued', entityType: 'Receipt', entityId: receipt.id, summary: receipt.receiptNumber });
    res.status(201).json({ data: receipt });
  }),
);

adminDonationsRouter.get(
  '/receipts/:receiptId/pdf',
  requirePermission('donations.view'),
  asyncHandler(async (req, res) => {
    const receipt = await prisma.receipt.findUniqueOrThrow({ where: { id: req.params.receiptId } });
    const pdf = await receiptPdf(receipt.id);
    res.type('application/pdf').attachment(`receipt-${receipt.receiptNumber.replace(/\//g, '-')}.pdf`).send(pdf);
  }),
);

adminDonationsRouter.post(
  '/receipts/:receiptId/email',
  requirePermission('donations.manage'),
  asyncHandler(async (req, res) => {
    const receipt = await prisma.receipt.findUniqueOrThrow({ where: { id: req.params.receiptId } });
    if (receipt.status !== 'ISSUED') throw AppError.badRequest('Void receipts cannot be emailed');
    const ok = await emailReceipt(receipt.id);
    await audit(req, { action: 'receipt.emailed', entityType: 'Receipt', entityId: receipt.id, summary: receipt.receiptNumber });
    res.json({ data: { ok } });
  }),
);

adminDonationsRouter.post(
  '/receipts/:receiptId/void',
  requirePermission('donations.manage'),
  asyncHandler(async (req, res) => {
    const body = parse(
      z.object({
        reason: z.string().trim().min(5).max(300),
        confirm: z.literal(true),
        correction: z.object({ name: z.string().trim().min(2).max(100), address: z.string().max(300), pan: z.string().max(10) }).nullable().default(null),
      }),
      req.body,
    );
    res.json({ data: await voidReceipt(req, req.params.receiptId, body.reason, body.correction) });
  }),
);

// ─── Donors ──────────────────────────────────────────────────────────────────────

export const adminDonorsRouter = Router();
adminDonorsRouter.use(requirePermission('donations.view'));

adminDonorsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const q = parse(z.object({ page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(100).default(25), q: z.string().max(200).optional(), format: z.enum(['json', 'csv']).default('json') }), req.query);
    const where: Prisma.DonorWhereInput = q.q ? { OR: [{ name: { contains: q.q, mode: 'insensitive' } }, { email: { contains: q.q, mode: 'insensitive' } }, { phone: { contains: q.q } }] } : {};
    const donors = await prisma.donor.findMany({ where, orderBy: { createdAt: 'desc' }, skip: q.format === 'csv' ? 0 : (q.page - 1) * q.limit, take: q.format === 'csv' ? 50000 : q.limit });
    const ids = donors.map((d) => d.id);
    const totals = await prisma.donation.groupBy({ by: ['donorId'], where: { donorId: { in: ids }, status: { in: ['SUCCESS', 'PARTIALLY_REFUNDED'] } }, _sum: { amount: true, refundedAmount: true }, _count: true, _max: { paidAt: true } });
    const map = new Map(totals.map((t) => [t.donorId, t]));
    const rows = donors.map((d) => {
      const t = map.get(d.id);
      return { ...d, totalGiven: (t?._sum.amount ?? 0) - (t?._sum.refundedAmount ?? 0), gifts: t?._count ?? 0, lastGiftAt: t?._max.paidAt ?? null };
    });
    if (q.format === 'csv') {
      if (!hasPermission(req.user, 'donations.export')) throw AppError.forbidden();
      await audit(req, { action: 'donors.exported', entityType: 'Donor', summary: `${rows.length} rows` });
      res.type('text/csv').attachment('donors.csv');
      return res.send(
        toCsv(
          rows.map((r) => ({ ...r, totalGiven: (r.totalGiven / 100).toFixed(2) })),
          [
            { key: 'name', label: 'Name' },
            { key: 'email', label: 'Email' },
            { key: 'phone', label: 'Phone' },
            { key: 'gifts', label: 'Gifts' },
            { key: 'totalGiven', label: 'Total given' },
            { key: 'lastGiftAt', label: 'Last gift' },
            { key: 'marketingOptIn', label: 'Marketing opt-in' },
            { key: 'doNotContact', label: 'Do not contact' },
          ],
        ),
      );
    }
    res.json({ data: rows, meta: pageMeta(q.page, q.limit, await prisma.donor.count({ where })) });
  }),
);

adminDonorsRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const donor = await prisma.donor.findUnique({
      where: { id: req.params.id },
      include: {
        donations: { orderBy: { createdAt: 'desc' }, include: { campaign: { select: { title: true } }, receipts: { select: { id: true, receiptNumber: true, status: true } } } },
        recurring: true,
      },
    });
    if (!donor) throw AppError.notFound();
    const notes = await prisma.internalNote.findMany({ where: { entityType: 'Donor', entityId: donor.id }, include: { author: { select: { name: true } } }, orderBy: { createdAt: 'desc' } });
    res.json({ data: { ...donor, notes } });
  }),
);

adminDonorsRouter.put(
  '/:id/preferences',
  requirePermission('donations.manage'),
  asyncHandler(async (req, res) => {
    const body = parse(z.object({ marketingOptIn: z.boolean(), doNotContact: z.boolean(), name: z.string().trim().min(2).max(100), phone: z.string().max(20), address: z.string().max(300), pan: z.string().max(10) }), req.body);
    const before = await prisma.donor.findUniqueOrThrow({ where: { id: req.params.id } });
    const donor = await prisma.donor.update({ where: { id: req.params.id }, data: { ...body, marketingConsentAt: body.marketingOptIn && !before.marketingOptIn ? new Date() : before.marketingConsentAt } });
    await audit(req, { action: 'donor.updated', entityType: 'Donor', entityId: donor.id, before, after: donor });
    res.json({ data: donor });
  }),
);

/** Erases personal data while keeping financial records intact (anonymised). */
adminDonorsRouter.post(
  '/:id/anonymise',
  requirePermission('donations.manage'),
  asyncHandler(async (req, res) => {
    parse(z.object({ confirm: z.literal(true), reason: z.string().trim().min(5).max(300) }), req.body);
    const before = await prisma.donor.findUniqueOrThrow({ where: { id: req.params.id } });
    await prisma.donor.update({
      where: { id: before.id },
      data: { name: 'Erased donor', email: `erased-${before.id}@invalid.local`, phone: '', pan: '', address: '', marketingOptIn: false, doNotContact: true },
    });
    await audit(req, { action: 'donor.anonymised', entityType: 'Donor', entityId: before.id, summary: String(req.body.reason) });
    res.json({ data: { ok: true } });
  }),
);
