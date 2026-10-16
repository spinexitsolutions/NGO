import { env } from '../../config/env.js';
import { AppError } from '../../utils/AppError.js';
import { hmacSha256Hex, safeEqual } from '../../utils/crypto.js';
import type { PaymentProvider } from './provider.js';

const API = 'https://api.razorpay.com/v1';

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) throw new AppError(503, 'PAYMENTS_NOT_CONFIGURED', 'Online payments are not configured yet.');
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: 'Basic ' + Buffer.from(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`).toString('base64'),
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15000),
  });
  const json = (await res.json().catch(() => ({}))) as T & { error?: { description?: string } };
  if (!res.ok) throw new AppError(502, 'PAYMENT_PROVIDER_ERROR', json.error?.description ?? 'Payment provider error');
  return json;
}

/** Webhook signature: HMAC-SHA256 of the raw request body with the webhook secret. */
export function verifyRazorpayWebhook(rawBody: Buffer, signature: string | undefined): boolean {
  if (!signature || !env.RAZORPAY_WEBHOOK_SECRET) return false;
  return safeEqual(hmacSha256Hex(env.RAZORPAY_WEBHOOK_SECRET, rawBody.toString('utf8')), signature);
}

export const razorpayProvider: PaymentProvider = {
  name: 'razorpay',
  get publicKey() {
    return env.RAZORPAY_KEY_ID;
  },
  async createOrder({ amount, currency, receipt, notes }) {
    const order = await call<{ id: string }>('POST', '/orders', { amount, currency, receipt, notes, payment_capture: 1 });
    return { orderId: order.id, raw: order };
  },
  async createSubscription({ amount, currency, reference, notes, totalCount }) {
    const plan = await call<{ id: string }>('POST', '/plans', {
      period: 'monthly',
      interval: 1,
      item: { name: `Monthly donation ${reference}`, amount, currency },
      notes,
    });
    const sub = await call<{ id: string }>('POST', '/subscriptions', { plan_id: plan.id, total_count: totalCount, customer_notify: 1, notes });
    return { subscriptionId: sub.id, planId: plan.id, raw: sub };
  },
  async cancelSubscription(subscriptionId) {
    await call('POST', `/subscriptions/${subscriptionId}/cancel`, { cancel_at_cycle_end: 0 });
  },
  verifyPaymentSignature({ orderId, subscriptionId, paymentId, signature }) {
    if (!env.RAZORPAY_KEY_SECRET) return false;
    // Orders: order_id|payment_id. Subscriptions: payment_id|subscription_id.
    const payload = subscriptionId ? `${paymentId}|${subscriptionId}` : `${orderId}|${paymentId}`;
    return safeEqual(hmacSha256Hex(env.RAZORPAY_KEY_SECRET, payload), signature);
  },
  async refund(paymentId, amount, notes) {
    const r = await call<{ id: string; status: string }>('POST', `/payments/${paymentId}/refund`, { amount, notes });
    return { refundId: r.id, status: r.status === 'processed' ? 'PROCESSED' : 'REQUESTED', raw: r };
  },
};
