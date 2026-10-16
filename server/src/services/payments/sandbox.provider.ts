import { env } from '../../config/env.js';
import { hmacSha256Hex, randomToken, safeEqual } from '../../utils/crypto.js';
import type { PaymentProvider } from './provider.js';

/**
 * Local simulator used until real gateway credentials are configured. No money moves.
 * The sandbox "gateway" endpoint (disabled in production) issues a signature exactly like Razorpay does,
 * so the verification path is identical to the real one.
 */
const SECRET = hmacSha256Hex(env.APP_SECRET, 'sandbox-gateway');

export function sandboxSign(payload: string): string {
  return hmacSha256Hex(SECRET, payload);
}

export const sandboxProvider: PaymentProvider = {
  name: 'sandbox',
  publicKey: 'sandbox',
  async createOrder({ amount, currency, receipt }) {
    const orderId = `order_sbx_${randomToken(10)}`;
    return { orderId, raw: { id: orderId, amount, currency, receipt } };
  },
  async createSubscription({ amount }) {
    const subscriptionId = `sub_sbx_${randomToken(10)}`;
    return { subscriptionId, planId: `plan_sbx_${amount}`, raw: { id: subscriptionId } };
  },
  async cancelSubscription() {},
  verifyPaymentSignature({ orderId, subscriptionId, paymentId, signature }) {
    const payload = subscriptionId ? `${paymentId}|${subscriptionId}` : `${orderId}|${paymentId}`;
    return safeEqual(sandboxSign(payload), signature);
  },
  async refund() {
    return { refundId: `rfnd_sbx_${randomToken(10)}`, status: 'PROCESSED', raw: {} };
  },
};
