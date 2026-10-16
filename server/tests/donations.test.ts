import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/config/db.js';
import { hmacSha256Hex } from '../src/utils/crypto.js';
import { client, loginAs, resetDb } from './helpers.js';

beforeEach(resetDb);

async function makeCampaign(overrides: Record<string, unknown> = {}) {
  return prisma.campaign.create({
    data: { slug: 'school-kits', title: 'School kits', summary: 's', coverImage: '/x.webp', goalAmount: 1_000_000, startDate: new Date(Date.now() - 86_400_000), status: 'ACTIVE', ...overrides },
  });
}

const donor = { name: 'Asha Rao', email: 'asha@example.org', phone: '', isAnonymous: false };

async function checkout(c: Awaited<ReturnType<typeof client>>, body: Record<string, unknown> = {}) {
  const res = await c.post('/api/v1/donations/checkout', { amount: 250_000, ...donor, ...body });
  return res;
}

async function payInSandbox(c: Awaited<ReturnType<typeof client>>, reference: string) {
  const auth = await c.post('/api/v1/donations/sandbox/authorize', { reference, outcome: 'success' });
  expect(auth.status).toBe(200);
  return c.post('/api/v1/donations/verify', { reference, ...auth.body.data });
}

function webhook(c: Awaited<ReturnType<typeof client>>, body: object, eventId: string, secret = 'rzp_test_webhook_secret') {
  const raw = JSON.stringify(body);
  return c.agent
    .post('/api/v1/webhooks/razorpay')
    .set('content-type', 'application/json')
    .set('x-razorpay-signature', hmacSha256Hex(secret, raw))
    .set('x-razorpay-event-id', eventId)
    .send(raw);
}

describe('donation checkout', () => {
  it('validates amounts on the server', async () => {
    const c = await client();
    expect((await checkout(c, { amount: 500 })).status).toBe(422); // below minimum (₹100)
    expect((await checkout(c, { amount: 12.5 })).status).toBe(422); // not integer minor units
    expect((await checkout(c, { amount: 10_000_000_000 })).status).toBe(422); // above maximum
  });

  it('rejects donations to inactive or unknown campaigns', async () => {
    await makeCampaign({ status: 'DRAFT' });
    const c = await client();
    expect((await checkout(c, { campaignSlug: 'school-kits' })).status).toBe(400);
    expect((await checkout(c, { campaignSlug: 'nope' })).status).toBe(400);
  });

  it('completes a sandbox payment: verified → SUCCESS, receipt issued, campaign total updated', async () => {
    const campaign = await makeCampaign();
    const c = await client();
    const res = await checkout(c, { campaignSlug: 'school-kits', utm: { source: 'newsletter', campaign: 'oct' } });
    expect(res.status).toBe(201);
    const { reference, key } = res.body.data;
    expect(key).toBe('sandbox'); // never a secret
    expect((await prisma.donation.findUniqueOrThrow({ where: { reference } })).status).toBe('PENDING');

    // Pending money is never counted.
    expect((await c.get('/api/v1/public/campaigns/school-kits')).body.data.raised).toBe(0);

    const verify = await payInSandbox(c, reference);
    expect(verify.body.data.status).toBe('SUCCESS');
    const d = await prisma.donation.findUniqueOrThrow({ where: { reference }, include: { receipts: true } });
    expect(d.utmSource).toBe('newsletter');
    expect(d.campaignId).toBe(campaign.id);
    expect(d.receipts).toHaveLength(1);
    expect(d.receipts[0].receiptNumber).toMatch(/^RCPT\/\d{4}-\d{2}\/000001$/);
    expect(await prisma.emailLog.count({ where: { templateKey: 'donation_receipt', relatedId: d.id } })).toBe(1);

    const pub = (await c.get('/api/v1/public/campaigns/school-kits')).body.data;
    expect(pub.raised).toBe(250_000);
    expect(pub.percent).toBe(25);
  });

  it('never marks a payment successful with a bad signature', async () => {
    const c = await client();
    const { reference, orderId } = (await checkout(c)).body.data;
    const res = await c.post('/api/v1/donations/verify', { reference, orderId, paymentId: 'pay_fake', signature: 'f'.repeat(64) });
    expect(res.status).toBe(400);
    expect((await prisma.donation.findUniqueOrThrow({ where: { reference } })).status).toBe('PENDING');
  });

  it('verification is idempotent (one success, one receipt)', async () => {
    const c = await client();
    const { reference } = (await checkout(c)).body.data;
    const auth = (await c.post('/api/v1/donations/sandbox/authorize', { reference, outcome: 'success' })).body.data;
    await c.post('/api/v1/donations/verify', { reference, ...auth });
    await c.post('/api/v1/donations/verify', { reference, ...auth });
    const d = await prisma.donation.findUniqueOrThrow({ where: { reference }, include: { receipts: true } });
    expect(d.receipts).toHaveLength(1);
    expect(await prisma.emailLog.count({ where: { templateKey: 'donation_receipt' } })).toBe(1);
  });

  it('a failure report cannot downgrade a successful donation', async () => {
    const c = await client();
    const { reference } = (await checkout(c)).body.data;
    await payInSandbox(c, reference);
    await c.post('/api/v1/donations/failed', { reference, reason: 'User closed the window' });
    expect((await prisma.donation.findUniqueOrThrow({ where: { reference } })).status).toBe('SUCCESS');
  });

  it('records failed payments', async () => {
    const c = await client();
    const { reference } = (await checkout(c)).body.data;
    await c.post('/api/v1/donations/sandbox/authorize', { reference, outcome: 'failure' });
    expect((await prisma.donation.findUniqueOrThrow({ where: { reference } })).status).toBe('FAILED');
    expect(await prisma.emailLog.count({ where: { templateKey: 'donation_failed' } })).toBe(1);
  });

  it('monthly giving creates a subscription and activates on first payment', async () => {
    const c = await client();
    const res = await checkout(c, { frequency: 'MONTHLY' });
    expect(res.body.data.subscriptionId).toBeTruthy();
    await payInSandbox(c, res.body.data.reference);
    const r = await prisma.recurringDonation.findFirstOrThrow();
    expect(r.status).toBe('ACTIVE');
  });

  it('does not overwrite an existing donor’s name from an anonymous form', async () => {
    await prisma.donor.create({ data: { email: 'asha@example.org', name: 'Asha Original' } });
    const c = await client();
    await checkout(c, { name: 'Someone Else' });
    expect((await prisma.donor.findUniqueOrThrow({ where: { email: 'asha@example.org' } })).name).toBe('Asha Original');
  });
});

describe('payment webhooks', () => {
  it('rejects invalid signatures', async () => {
    const c = await client();
    const res = await webhook(c, { event: 'payment.captured', payload: {} }, 'evt_1', 'wrong-secret');
    expect(res.status).toBe(400);
    expect(await prisma.webhookEvent.count()).toBe(0);
  });

  it('marks the donation successful once, even if the webhook is delivered twice', async () => {
    const c = await client();
    const { reference, orderId } = (await checkout(c)).body.data;
    const body = { event: 'payment.captured', payload: { payment: { entity: { id: 'pay_123', order_id: orderId, amount: 250_000, status: 'captured' } } } };
    const first = await webhook(c, body, 'evt_dup');
    const second = await webhook(c, body, 'evt_dup');
    expect(first.status).toBe(200);
    expect(second.body.data.duplicate).toBe(true);
    const d = await prisma.donation.findUniqueOrThrow({ where: { reference }, include: { receipts: true, transactions: true } });
    expect(d.status).toBe('SUCCESS');
    expect(d.receipts).toHaveLength(1);
    expect(d.transactions.filter((t) => t.status === 'SUCCESS')).toHaveLength(1);
    expect(await prisma.webhookEvent.count()).toBe(1);
  });

  it('a different event for an already-paid order is a no-op', async () => {
    const c = await client();
    const { orderId } = (await checkout(c)).body.data;
    const p = { payment: { entity: { id: 'pay_9', order_id: orderId, amount: 250_000, status: 'captured' } } };
    await webhook(c, { event: 'payment.captured', payload: p }, 'evt_a');
    await webhook(c, { event: 'order.paid', payload: p }, 'evt_b');
    expect(await prisma.receipt.count()).toBe(1);
  });

  it('does not accept a payment whose amount differs from the donation', async () => {
    const c = await client();
    const { reference, orderId } = (await checkout(c)).body.data;
    await webhook(c, { event: 'payment.captured', payload: { payment: { entity: { id: 'pay_x', order_id: orderId, amount: 100, status: 'captured' } } } }, 'evt_m');
    expect((await prisma.donation.findUniqueOrThrow({ where: { reference } })).status).toBe('PENDING');
  });

  it('payment.failed after success does not downgrade', async () => {
    const c = await client();
    const { reference, orderId } = (await checkout(c)).body.data;
    await payInSandbox(c, reference);
    await webhook(c, { event: 'payment.failed', payload: { payment: { entity: { id: 'pay_f', order_id: orderId, amount: 250_000, status: 'failed' } } } }, 'evt_f');
    expect((await prisma.donation.findUniqueOrThrow({ where: { reference } })).status).toBe('SUCCESS');
  });
});

describe('staff donation management', () => {
  it('refunds partially then fully, never more than paid', async () => {
    const c = await client();
    const { reference } = (await checkout(c)).body.data;
    await payInSandbox(c, reference);
    const d = await prisma.donation.findUniqueOrThrow({ where: { reference } });
    const fin = await loginAs('finance_manager');
    expect((await fin.post(`/api/v1/admin/donations/${d.id}/refund`, { amount: 100_000, reason: 'Duplicate', confirm: true })).status).toBe(200);
    expect((await prisma.donation.findUniqueOrThrow({ where: { id: d.id } })).status).toBe('PARTIALLY_REFUNDED');
    expect((await fin.post(`/api/v1/admin/donations/${d.id}/refund`, { amount: 200_000, reason: 'Too much', confirm: true })).status).toBe(422);
    await fin.post(`/api/v1/admin/donations/${d.id}/refund`, { amount: 150_000, reason: 'Rest', confirm: true });
    const after = await prisma.donation.findUniqueOrThrow({ where: { id: d.id } });
    expect(after.status).toBe('REFUNDED');
    expect(after.refundedAmount).toBe(250_000);
    expect(await prisma.auditLog.count({ where: { action: 'donation.refunded' } })).toBe(2);
  });

  it('records an offline donation with an audit trail and receipt', async () => {
    const fin = await loginAs('finance_manager');
    const res = await fin.post('/api/v1/admin/donations/offline', {
      name: 'Ravi', email: 'ravi@example.org', amount: 1_000_000, method: 'BANK_TRANSFER', offlineReference: 'UTR123', receivedAt: new Date().toISOString().slice(0, 10), issueReceipt: true,
    });
    expect(res.status).toBe(201);
    const d = await prisma.donation.findUniqueOrThrow({ where: { id: res.body.data.id }, include: { receipts: true } });
    expect(d.status).toBe('SUCCESS');
    expect(d.isOffline).toBe(true);
    expect(d.recordedById).toBe(fin.user.id);
    expect(d.receipts).toHaveLength(1);
    expect(await prisma.auditLog.count({ where: { action: 'donation.offline_recorded', entityId: d.id } })).toBe(1);
  });

  it('generates a PDF receipt and supports void + correction', async () => {
    const c = await client();
    const { reference } = (await checkout(c)).body.data;
    await payInSandbox(c, reference);
    const receipt = await prisma.receipt.findFirstOrThrow();
    const fin = await loginAs('finance_manager');
    const pdf = await fin.get(`/api/v1/admin/donations/receipts/${receipt.id}/pdf`).buffer(true).parse((res, cb) => {
      const chunks: Buffer[] = [];
      res.on('data', (d: Buffer) => chunks.push(d));
      res.on('end', () => cb(null, Buffer.concat(chunks)));
    });
    expect(pdf.status).toBe(200);
    expect((pdf.body as Buffer).subarray(0, 5).toString()).toBe('%PDF-');
    const v = await fin.post(`/api/v1/admin/donations/receipts/${receipt.id}/void`, { reason: 'Name misspelt', confirm: true, correction: { name: 'Asha R. Rao', address: '', pan: '' } });
    expect(v.status).toBe(200);
    expect(v.body.data.replacement.receiptNumber).not.toBe(receipt.receiptNumber);
    expect((await prisma.receipt.findUniqueOrThrow({ where: { id: receipt.id } })).status).toBe('VOIDED');
    expect(await prisma.auditLog.count({ where: { action: 'receipt.corrected' } })).toBe(1);
  });

  it('exports CSV only with the export permission', async () => {
    const cm = await loginAs('campaign_manager'); // can view donations, cannot export
    expect((await cm.get('/api/v1/admin/donations')).status).toBe(200);
    expect((await cm.get('/api/v1/admin/donations?format=csv')).status).toBe(403);
    const fin = await loginAs('finance_manager');
    const csv = await fin.get('/api/v1/admin/donations?format=csv');
    expect(csv.status).toBe(200);
    expect(csv.text).toContain('reference');
  });

  it('dashboard separates successful, pending and failed donations', async () => {
    const c = await client();
    const ok = (await checkout(c)).body.data.reference;
    await payInSandbox(c, ok);
    await checkout(c, { amount: 100_000 }); // stays pending
    const failed = (await checkout(c, { amount: 300_000 })).body.data.reference;
    await c.post('/api/v1/donations/sandbox/authorize', { reference: failed, outcome: 'failure' });
    const fin = await loginAs('finance_manager');
    const data = (await fin.get('/api/v1/admin/dashboard/overview')).body.data;
    expect(data.finance.netRaised).toBe(250_000);
    expect(data.finance.byStatus.PENDING.amount).toBe(100_000);
    expect(data.finance.byStatus.FAILED.amount).toBe(300_000);
  });
});

describe('donor portal', () => {
  it('magic link gives access to own donations and receipts only', async () => {
    const c = await client();
    const { reference } = (await checkout(c)).body.data;
    await payInSandbox(c, reference);
    expect((await c.get('/api/v1/donor/me')).status).toBe(401);
    await c.post('/api/v1/donor/login', { email: 'asha@example.org' });
    const log = await prisma.emailLog.findFirstOrThrow({ where: { templateKey: 'donor_login' } });
    expect(log.status).toBe('SENT');
    // Token is only in the email; simulate by creating one directly.
    const { sha256 } = await import('../src/utils/crypto.js');
    const donor = await prisma.donor.findUniqueOrThrow({ where: { email: 'asha@example.org' } });
    await prisma.donorLoginToken.create({ data: { tokenHash: sha256('magic-token-0123456789abcdef'), donorId: donor.id, expiresAt: new Date(Date.now() + 60_000) } });
    expect((await c.post('/api/v1/donor/session', { token: 'magic-token-0123456789abcdef' })).status).toBe(200);
    const me = await c.get('/api/v1/donor/me');
    expect(me.body.data.donations).toHaveLength(1);
    expect((await c.post('/api/v1/donor/session', { token: 'magic-token-0123456789abcdef' })).status).toBe(400); // single use
  });
});
