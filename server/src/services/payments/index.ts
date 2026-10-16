import { env } from '../../config/env.js';
import type { PaymentProvider } from './provider.js';
import { razorpayProvider } from './razorpay.provider.js';
import { sandboxProvider } from './sandbox.provider.js';

export const PROVIDERS: Record<string, PaymentProvider> = { razorpay: razorpayProvider, sandbox: sandboxProvider };

export function activeProvider(): PaymentProvider {
  return env.PAYMENT_PROVIDER === 'razorpay' ? razorpayProvider : sandboxProvider;
}

export function providerFor(name: string): PaymentProvider {
  return PROVIDERS[name] ?? activeProvider();
}
