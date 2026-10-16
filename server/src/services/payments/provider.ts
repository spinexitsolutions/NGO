export interface CreateOrderInput {
  amount: number; // minor units
  currency: string;
  receipt: string; // our donation reference
  notes: Record<string, string>;
}

export interface CreateSubscriptionInput {
  amount: number;
  currency: string;
  reference: string;
  notes: Record<string, string>;
  totalCount: number;
}

export interface PaymentProvider {
  name: 'razorpay' | 'sandbox';
  /** Public key the browser needs to open checkout (never the secret). */
  publicKey: string;
  createOrder(input: CreateOrderInput): Promise<{ orderId: string; raw: unknown }>;
  createSubscription(input: CreateSubscriptionInput): Promise<{ subscriptionId: string; planId: string; raw: unknown }>;
  cancelSubscription(subscriptionId: string): Promise<void>;
  /** Checks the signature returned to the browser after payment. */
  verifyPaymentSignature(input: { orderId?: string; subscriptionId?: string; paymentId: string; signature: string }): boolean;
  refund(paymentId: string, amount: number, notes: Record<string, string>): Promise<{ refundId: string; status: 'PROCESSED' | 'REQUESTED'; raw: unknown }>;
}
