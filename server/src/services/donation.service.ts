import type { Request } from 'express';
import { Prisma, type Donation } from '@prisma/client';
import { formatMoney, type DonationCheckoutInput } from '@ngo/shared';
import { prisma } from '../config/db.js';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { AppError } from '../utils/AppError.js';
import { reference } from '../utils/crypto.js';
import { audit } from './audit.service.js';
import { getPublished } from './config.service.js';
import { sendTemplate } from './email.service.js';
import { alertStaff } from './notification.service.js';
import { activeProvider, providerFor } from './payments/index.js';
import { issueReceipt, receiptPdf } from './receipt.service.js';

export const COUNTED_STATUSES = ['SUCCESS', 'PARTIALLY_REFUNDED'] as const;

/** Net amount raised (successful minus refunded) — the only source for public totals. */
export function netRaisedWhere(where: Prisma.DonationWhereInput = {}) {
  return prisma.donation
    .aggregate({ where: { ...where, status: { in: [...COUNTED_STATUSES] } }, _sum: { amount: true, refundedAmount: true }, _count: true })
    .then((r) => ({ raised: (r._sum.amount ?? 0) - (r._sum.refundedAmount ?? 0), count: r._count }));
}

export async function campaignTotals(campaignIds: string[]) {
  if (!campaignIds.length) return new Map<string, { raised: number; donors: number }>();
  const rows = await prisma.$queryRaw<{ campaignId: string; raised: bigint; donors: bigint }[]>`
    SELECT "campaignId", COALESCE(SUM("amount" - "refundedAmount"), 0) AS raised, COUNT(DISTINCT "donorId") AS donors
    FROM "Donation"
    WHERE "campaignId" IN (${Prisma.join(campaignIds)}) AND "status" IN ('SUCCESS', 'PARTIALLY_REFUNDED')
    GROUP BY "campaignId"`;
  return new Map(rows.map((r) => [r.campaignId, { raised: Number(r.raised), donors: Number(r.donors) }]));
}

// ─── Checkout ───────────────────────────────────────────────────────────────────

export async function createCheckout(input: DonationCheckoutInput) {
  const settings = await getPublished('settings');
  const d = settings.donation;
  if (!Number.isInteger(input.amount) || input.amount < d.minAmount || input.amount > d.maxAmount) {
    throw AppError.validation('Invalid amount', [
      { path: 'amount', message: `Amount must be between ${formatMoney(d.minAmount, d.currency)} and ${formatMoney(d.maxAmount, d.currency)}` },
    ]);
  }
  if (input.frequency === 'MONTHLY' && !d.recurringEnabled) throw AppError.badRequest('Monthly giving is not available right now');
  if (input.isAnonymous && !d.allowAnonymous) throw AppError.badRequest('Anonymous donations are not enabled');

  const now = new Date();
  let campaignId: string | null = null;
  let causeId: string | null = null;
  let eventId: string | null = null;
  if (input.campaignSlug) {
    const c = await prisma.campaign.findUnique({ where: { slug: input.campaignSlug } });
    if (!c || c.status !== 'ACTIVE' || c.startDate > now || (c.endDate && c.endDate < startOfDay(now)))
      throw AppError.badRequest('This campaign is not accepting donations');
    campaignId = c.id;
    causeId = c.causeId;
  }
  if (input.causeSlug && !causeId) {
    const c = await prisma.cause.findUnique({ where: { slug: input.causeSlug } });
    if (!c || c.status !== 'PUBLISHED') throw AppError.badRequest('Unknown cause');
    causeId = c.id;
  }
  if (input.eventSlug) {
    const e = await prisma.event.findUnique({ where: { slug: input.eventSlug } });
    if (!e || e.status !== 'PUBLISHED' || !e.isFundraiser) throw AppError.badRequest('This event is not accepting donations');
    eventId = e.id;
    campaignId ??= e.campaignId;
  }

  // Donor records are created on first gift. Existing records are only filled in, never overwritten by
  // an anonymous web form (anyone can type any email address).
  const existing = await prisma.donor.findUnique({ where: { email: input.email } });
  const donor = existing
    ? await prisma.donor.update({
        where: { id: existing.id },
        data: {
          phone: existing.phone || input.phone,
          pan: existing.pan || input.pan,
          address: existing.address || input.address,
          ...(input.marketingOptIn && !existing.marketingOptIn ? { marketingOptIn: true, marketingConsentAt: now } : {}),
        },
      })
    : await prisma.donor.create({
        data: {
          email: input.email,
          name: input.name,
          phone: input.phone,
          pan: input.pan,
          address: input.address,
          marketingOptIn: input.marketingOptIn,
          marketingConsentAt: input.marketingOptIn ? now : null,
        },
      });

  const provider = activeProvider();
  const ref = reference('DN');
  const notes = { reference: ref, campaign: input.campaignSlug ?? '', cause: input.causeSlug ?? '' };
  const base = {
    reference: ref,
    donorId: donor.id,
    amount: input.amount,
    currency: d.currency,
    frequency: input.frequency,
    isAnonymous: input.isAnonymous,
    message: input.message,
    campaignId,
    causeId,
    eventId,
    provider: provider.name,
    utmSource: input.utm?.source ?? '',
    utmMedium: input.utm?.medium ?? '',
    utmCampaign: input.utm?.campaign ?? '',
    referrer: input.utm?.referrer ?? '',
  };

  if (input.frequency === 'MONTHLY') {
    const sub = await provider.createSubscription({ amount: input.amount, currency: d.currency, reference: ref, notes, totalCount: 120 });
    const recurring = await prisma.recurringDonation.create({
      data: {
        reference: ref,
        donorId: donor.id,
        amount: input.amount,
        currency: d.currency,
        campaignId,
        causeId,
        provider: provider.name,
        providerPlanId: sub.planId,
        providerSubscriptionId: sub.subscriptionId,
        isAnonymous: input.isAnonymous,
      },
    });
    const donation = await prisma.donation.create({
      data: {
        ...base,
        recurringId: recurring.id,
        transactions: { create: { provider: provider.name, type: 'SUBSCRIPTION_CREATED', providerRef: sub.subscriptionId, amount: input.amount, status: 'CREATED', raw: sub.raw as Prisma.InputJsonValue } },
      },
    });
    return checkoutPayload(donation, donor, { subscriptionId: sub.subscriptionId });
  }

  const order = await provider.createOrder({ amount: input.amount, currency: d.currency, receipt: ref, notes });
  const donation = await prisma.donation.create({
    data: {
      ...base,
      providerOrderId: order.orderId,
      transactions: { create: { provider: provider.name, type: 'ORDER_CREATED', providerRef: order.orderId, amount: input.amount, status: 'CREATED', raw: order.raw as Prisma.InputJsonValue } },
    },
  });
  return checkoutPayload(donation, donor, { orderId: order.orderId });
}

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

async function checkoutPayload(donation: Donation, donor: { name: string; email: string; phone: string }, ids: { orderId?: string; subscriptionId?: string }) {
  const settings = await getPublished('settings');
  const provider = providerFor(donation.provider);
  return {
    reference: donation.reference,
    provider: provider.name,
    key: provider.publicKey, // public key id only
    amount: donation.amount,
    currency: donation.currency,
    frequency: donation.frequency,
    ...ids,
    name: settings.organization.name,
    prefill: { name: donor.name, email: donor.email, contact: donor.phone },
  };
}

// ─── Verification & status transitions ──────────────────────────────────────────

export interface VerifyInput {
  reference: string;
  paymentId: string;
  signature: string;
  orderId?: string;
  subscriptionId?: string;
}

/** Verifies the checkout signature, then marks the donation successful. Idempotent. */
export async function verifyCheckout(input: VerifyInput) {
  const donation = await prisma.donation.findUnique({ where: { reference: input.reference }, include: { recurring: true } });
  if (!donation) throw AppError.notFound('Donation not found');
  const provider = providerFor(donation.provider);
  const subscriptionId = donation.recurring?.providerSubscriptionId;
  const valid =
    (subscriptionId ? input.subscriptionId === subscriptionId : input.orderId === donation.providerOrderId) &&
    provider.verifyPaymentSignature({ orderId: donation.providerOrderId ?? undefined, subscriptionId, paymentId: input.paymentId, signature: input.signature });
  if (!valid) {
    await prisma.paymentTransaction.create({
      data: { donationId: donation.id, provider: provider.name, type: 'SIGNATURE_REJECTED', providerRef: input.paymentId, amount: donation.amount, status: 'REJECTED' },
    });
    throw AppError.badRequest('Payment could not be verified');
  }
  await markSuccess(donation.id, { paymentId: input.paymentId, amount: donation.amount, source: 'PAYMENT_VERIFIED' });
  if (donation.recurringId) await prisma.recurringDonation.update({ where: { id: donation.recurringId }, data: { status: 'ACTIVE' } });
  return prisma.donation.findUniqueOrThrow({ where: { id: donation.id } });
}

/**
 * Moves a donation to SUCCESS exactly once (atomic conditional update), records the provider event,
 * then issues the receipt and sends the confirmation. Repeated calls are no-ops.
 */
export async function markSuccess(donationId: string, opts: { paymentId: string; amount: number; source: string; raw?: unknown }) {
  const donation = await prisma.donation.findUniqueOrThrow({ where: { id: donationId } });
  if (opts.amount !== donation.amount) {
    await prisma.paymentTransaction.create({
      data: { donationId, provider: donation.provider, type: 'AMOUNT_MISMATCH', providerRef: opts.paymentId, amount: opts.amount, status: 'REJECTED', raw: (opts.raw ?? {}) as Prisma.InputJsonValue },
    });
    logger.error({ donationId, expected: donation.amount, got: opts.amount }, 'Payment amount mismatch — not marking as successful');
    await alertStaff({ permission: 'donations.manage', type: 'payment_mismatch', title: `Amount mismatch on ${donation.reference}`, link: `/admin/donations/${donationId}`, email: true });
    return false;
  }
  const transitioned = await prisma.$transaction(async (tx) => {
    const r = await tx.donation.updateMany({
      where: { id: donationId, status: { in: ['PENDING', 'FAILED'] } },
      data: { status: 'SUCCESS', providerPaymentId: opts.paymentId, paidAt: new Date(), failureReason: '' },
    });
    await tx.paymentTransaction.create({
      data: { donationId, provider: donation.provider, type: opts.source, providerRef: opts.paymentId, amount: opts.amount, status: r.count ? 'SUCCESS' : 'DUPLICATE', raw: (opts.raw ?? {}) as Prisma.InputJsonValue },
    });
    return r.count === 1;
  });
  if (transitioned) await afterSuccess(donationId);
  return transitioned;
}

async function afterSuccess(donationId: string) {
  try {
    const receipt = await issueReceipt(donationId);
    await emailReceipt(receipt.id);
    const d = await prisma.donation.findUniqueOrThrow({ where: { id: donationId }, include: { campaign: true } });
    await alertStaff({
      permission: 'donations.view',
      type: 'donation',
      title: `New donation ${formatMoney(d.amount, d.currency)}${d.campaign ? ` · ${d.campaign.title}` : ''}`,
      link: `/admin/donations/${donationId}`,
    });
  } catch (err) {
    logger.error({ err, donationId }, 'Post-payment processing failed (donation is still recorded as successful)');
  }
}

export async function emailReceipt(receiptId: string) {
  const receipt = await prisma.receipt.findUniqueOrThrow({ where: { id: receiptId }, include: { donation: { include: { donor: true, campaign: true } } } });
  const { donation } = receipt;
  const pdf = await receiptPdf(receipt.id);
  const ok = await sendTemplate({
    to: donation.donor.email,
    template: 'donation_receipt',
    vars: {
      donorName: donation.donor.name,
      amount: formatMoney(donation.amount, donation.currency),
      reference: donation.reference,
      receiptNumber: receipt.receiptNumber,
      campaign: donation.campaign ? ` for “${donation.campaign.title}”` : '',
      date: (donation.paidAt ?? donation.createdAt).toLocaleDateString('en-IN', { dateStyle: 'long' }),
      portalUrl: `${env.PUBLIC_SITE_URL}/donor`,
    },
    attachments: [{ filename: `receipt-${receipt.receiptNumber.replace(/\//g, '-')}.pdf`, content: pdf, contentType: 'application/pdf' }],
    related: { type: 'Donation', id: donation.id },
  });
  if (ok) await prisma.receipt.update({ where: { id: receiptId }, data: { emailedAt: new Date() } });
  return ok;
}

/** Only PENDING donations can fail; a successful payment is never downgraded by a later failure event. */
export async function markFailed(donationId: string, reason: string, raw?: unknown, notify = true) {
  const donation = await prisma.donation.findUniqueOrThrow({ where: { id: donationId }, include: { donor: true } });
  const r = await prisma.donation.updateMany({ where: { id: donationId, status: 'PENDING' }, data: { status: 'FAILED', failureReason: reason.slice(0, 300) } });
  await prisma.paymentTransaction.create({
    data: { donationId, provider: donation.provider, type: 'PAYMENT_FAILED', amount: donation.amount, status: r.count ? 'FAILED' : 'IGNORED', raw: (raw ?? { reason }) as Prisma.InputJsonValue },
  });
  if (r.count && notify) {
    await sendTemplate({
      to: donation.donor.email,
      template: 'donation_failed',
      vars: {
        donorName: donation.donor.name,
        amount: formatMoney(donation.amount, donation.currency),
        reference: donation.reference,
        retryUrl: `${env.PUBLIC_SITE_URL}/donate`,
      },
      related: { type: 'Donation', id: donation.id },
    });
  }
  return r.count === 1;
}

// ─── Webhooks ─────────────────────────────────────────────────────────────────────

interface RazorpayEvent {
  event: string;
  payload: {
    payment?: { entity: { id: string; order_id?: string; amount: number; status: string; error_description?: string; subscription_id?: string } };
    refund?: { entity: { id: string; payment_id: string; amount: number; status: string } };
    subscription?: { entity: { id: string; status: string } };
  };
}

/** Records the event once (unique provider+eventId) and processes it. Duplicate deliveries are ignored. */
export async function handleWebhook(provider: string, eventId: string, body: RazorpayEvent) {
  try {
    await prisma.webhookEvent.create({ data: { provider, eventId, type: body.event, payload: body as unknown as Prisma.InputJsonValue } });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') return { duplicate: true };
    throw err;
  }
  let status = 'PROCESSED';
  let error = '';
  try {
    status = await processEvent(body);
  } catch (err) {
    status = 'FAILED';
    error = err instanceof Error ? err.message : String(err);
    logger.error({ err, eventId }, 'Webhook processing failed');
  }
  await prisma.webhookEvent.update({ where: { provider_eventId: { provider, eventId } }, data: { status, error, processedAt: new Date() } });
  if (status === 'FAILED') throw new AppError(500, 'WEBHOOK_FAILED', 'Processing failed');
  return { duplicate: false, status };
}

async function processEvent(body: RazorpayEvent): Promise<string> {
  const payment = body.payload.payment?.entity;
  switch (body.event) {
    case 'payment.captured':
    case 'order.paid': {
      if (!payment) return 'IGNORED';
      if (payment.subscription_id || !payment.order_id) return 'IGNORED'; // handled by subscription.charged
      const donation = await prisma.donation.findUnique({ where: { providerOrderId: payment.order_id } });
      if (!donation) return 'IGNORED';
      await markSuccess(donation.id, { paymentId: payment.id, amount: payment.amount, source: 'PAYMENT_CAPTURED', raw: payment });
      return 'PROCESSED';
    }
    case 'payment.failed': {
      if (!payment?.order_id) return 'IGNORED';
      const donation = await prisma.donation.findUnique({ where: { providerOrderId: payment.order_id } });
      if (!donation) return 'IGNORED';
      await markFailed(donation.id, payment.error_description ?? 'Payment failed', payment);
      return 'PROCESSED';
    }
    case 'subscription.charged': {
      const sub = body.payload.subscription?.entity;
      if (!sub || !payment) return 'IGNORED';
      const recurring = await prisma.recurringDonation.findUnique({ where: { providerSubscriptionId: sub.id }, include: { donations: { where: { status: 'PENDING' }, take: 1 } } });
      if (!recurring) return 'IGNORED';
      await prisma.recurringDonation.update({ where: { id: recurring.id }, data: { status: 'ACTIVE' } });
      // First charge completes the pending checkout donation; later charges create new donations.
      const already = await prisma.donation.findUnique({ where: { providerPaymentId: payment.id } });
      if (already) return 'IGNORED';
      const target =
        recurring.donations[0] ??
        (await prisma.donation.create({
          data: {
            reference: reference('DN'),
            donorId: recurring.donorId,
            amount: recurring.amount,
            currency: recurring.currency,
            frequency: 'MONTHLY',
            campaignId: recurring.campaignId,
            causeId: recurring.causeId,
            recurringId: recurring.id,
            isAnonymous: recurring.isAnonymous,
            provider: recurring.provider,
          },
        }));
      await markSuccess(target.id, { paymentId: payment.id, amount: payment.amount, source: 'SUBSCRIPTION_CHARGED', raw: payment });
      return 'PROCESSED';
    }
    case 'subscription.halted':
    case 'subscription.cancelled':
    case 'subscription.completed': {
      const sub = body.payload.subscription?.entity;
      if (!sub) return 'IGNORED';
      const status = body.event === 'subscription.halted' ? 'HALTED' : body.event === 'subscription.cancelled' ? 'CANCELLED' : 'COMPLETED';
      const r = await prisma.recurringDonation.updateMany({ where: { providerSubscriptionId: sub.id }, data: { status } });
      return r.count ? 'PROCESSED' : 'IGNORED';
    }
    case 'refund.processed':
    case 'refund.failed': {
      const refund = body.payload.refund?.entity;
      if (!refund) return 'IGNORED';
      const r = await prisma.refund.updateMany({
        where: { providerRefundId: refund.id },
        data: { status: body.event === 'refund.processed' ? 'PROCESSED' : 'FAILED' },
      });
      return r.count ? 'PROCESSED' : 'IGNORED';
    }
    default:
      return 'IGNORED';
  }
}

// ─── Staff actions ────────────────────────────────────────────────────────────────

export async function refundDonation(req: Request, donationId: string, amount: number, reason: string) {
  const donation = await prisma.donation.findUniqueOrThrow({ where: { id: donationId }, include: { donor: true } });
  if (!['SUCCESS', 'PARTIALLY_REFUNDED'].includes(donation.status)) throw AppError.badRequest('Only successful donations can be refunded');
  const refundable = donation.amount - donation.refundedAmount;
  if (amount <= 0 || amount > refundable) throw AppError.validation('Invalid refund amount', [{ path: 'amount', message: `Maximum refundable is ${formatMoney(refundable, donation.currency)}` }]);

  let providerRefundId: string | null = null;
  let status: 'PROCESSED' | 'REQUESTED' = 'PROCESSED';
  let raw: unknown = { offline: true };
  if (!donation.isOffline && donation.providerPaymentId) {
    const r = await providerFor(donation.provider).refund(donation.providerPaymentId, amount, { reference: donation.reference, reason });
    providerRefundId = r.refundId;
    status = r.status;
    raw = r.raw;
  }
  const newRefunded = donation.refundedAmount + amount;
  const refund = await prisma.$transaction(async (tx) => {
    // Guard against concurrent refunds: the update only applies if refundedAmount hasn't changed.
    const u = await tx.donation.updateMany({
      where: { id: donation.id, refundedAmount: donation.refundedAmount },
      data: { refundedAmount: newRefunded, status: newRefunded >= donation.amount ? 'REFUNDED' : 'PARTIALLY_REFUNDED' },
    });
    if (!u.count) throw AppError.conflict('The donation changed while refunding. Please reload and try again.');
    const created = await tx.refund.create({ data: { donationId: donation.id, amount, reason, status, providerRefundId, createdById: req.user?.id } });
    await tx.paymentTransaction.create({
      data: { donationId: donation.id, provider: donation.provider || 'offline', type: 'REFUND_CREATED', providerRef: providerRefundId ?? '', amount, status, raw: raw as Prisma.InputJsonValue },
    });
    await audit(req, { action: 'donation.refunded', entityType: 'Donation', entityId: donation.id, summary: `${formatMoney(amount, donation.currency)} — ${reason}`, before: { status: donation.status, refundedAmount: donation.refundedAmount }, after: { refundedAmount: newRefunded } }, tx);
    return created;
  });
  await sendTemplate({
    to: donation.donor.email,
    template: 'donation_refunded',
    vars: { donorName: donation.donor.name, amount: formatMoney(amount, donation.currency), reference: donation.reference },
    related: { type: 'Donation', id: donation.id },
  });
  return refund;
}

export interface OfflineDonationInput {
  name: string;
  email: string;
  phone: string;
  amount: number;
  method: 'BANK_TRANSFER' | 'UPI' | 'CHEQUE' | 'CASH' | 'OTHER';
  offlineReference: string;
  receivedAt: string;
  campaignId?: string | null;
  causeId?: string | null;
  notes: string;
  issueReceipt: boolean;
  isAnonymous: boolean;
}

/** Staff-recorded donation (bank transfer, cheque…). Fully audited. */
export async function recordOfflineDonation(req: Request, input: OfflineDonationInput) {
  const settings = await getPublished('settings');
  const email = input.email.toLowerCase();
  const donor = await prisma.donor.upsert({ where: { email }, create: { email, name: input.name, phone: input.phone }, update: {} });
  const donation = await prisma.$transaction(async (tx) => {
    const created = await tx.donation.create({
      data: {
        reference: reference('DN'),
        donorId: donor.id,
        amount: input.amount,
        currency: settings.donation.currency,
        status: 'SUCCESS',
        method: input.method,
        isOffline: true,
        isAnonymous: input.isAnonymous,
        offlineReference: input.offlineReference,
        campaignId: input.campaignId || null,
        causeId: input.causeId || null,
        paidAt: new Date(input.receivedAt),
        recordedById: req.user!.id,
        message: input.notes,
        transactions: { create: { provider: 'offline', type: 'OFFLINE_RECORDED', providerRef: input.offlineReference, amount: input.amount, status: 'SUCCESS' } },
      },
    });
    await audit(req, { action: 'donation.offline_recorded', entityType: 'Donation', entityId: created.id, summary: `${formatMoney(input.amount, created.currency)} via ${input.method}`, after: created }, tx);
    return created;
  });
  if (input.issueReceipt) {
    const receipt = await issueReceipt(donation.id);
    await emailReceipt(receipt.id);
  }
  return donation;
}
