/**
 * SePay payment provider adapter (Vietnam VietQR bank transfer).
 * SePay generates a VietQR payment URL — no card processing involved.
 * Webhook callback is verified via HMAC-SHA256 signature.
 */

import { createHmac } from 'crypto';
import type { BillingPlan, PaymentIntent } from '@fhirbridge/types';
import type { PaymentProviderAdapter, WebhookEvent } from './payment-provider-interface.js';

/** SePay webhook callback payload shape */
interface SepayWebhookPayload {
  orderId?: string;
  userId?: string;
  amount?: number;
  status?: string;
  signature?: string;
  [key: string]: unknown;
}

export class SepayProvider implements PaymentProviderAdapter {
  readonly name = 'sepay' as const;

  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(apiKey: string, baseUrl = 'https://my.sepay.vn/userapi') {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }

  async createSubscription(userId: string, plan: BillingPlan): Promise<PaymentIntent> {
    // SePay VietQR: generate a payment URL with order details.
    // The user scans the QR code via their banking app — no card data involved.
    const orderId = `FB-${userId.slice(0, 8)}-${Date.now()}`;
    const description = `FHIRBridge ${plan.tier} plan`;

    // Build VietQR deep-link URL. SePay embeds bank + amount in a QR code.
    const params = new URLSearchParams({
      amount: String(plan.pricePerMonth), // cents → converted to VND on SePay side
      content: description,
      order_id: orderId,
      api_key: this.apiKey,
    });
    const paymentUrl = `${this.baseUrl}/transaction/create?${params.toString()}`;

    return {
      id: orderId,
      provider: 'sepay',
      amount: plan.pricePerMonth,
      currency: 'vnd',
      status: 'pending',
      metadata: {
        checkoutUrl: paymentUrl,
        orderId,
        userId,
        tier: plan.tier,
      },
    };
  }

  async cancelSubscription(subscriptionId: string): Promise<void> {
    // SePay bank transfers do not have cancellable subscriptions;
    // cancellation is handled via refund policy / manual process.
    void subscriptionId;
  }

  async getSubscriptionStatus(
    _subscriptionId: string,
  ): Promise<'active' | 'cancelled' | 'past_due'> {
    // SePay does not provide subscription lifecycle API — status managed internally.
    return 'active';
  }

  async handleWebhook(payload: unknown, signature: string): Promise<WebhookEvent> {
    const body = payload as SepayWebhookPayload;

    // Verify HMAC-SHA256 signature: HMAC(apiKey, orderId + amount + status)
    const message = `${body['orderId'] ?? ''}${body['amount'] ?? ''}${body['status'] ?? ''}`;
    const expected = createHmac('sha256', this.apiKey).update(message).digest('hex');

    if (expected !== signature) {
      throw new Error('SePay webhook signature verification failed');
    }

    const userId = body['userId'] ?? '';
    const status = body['status'];
    const data = body as Record<string, unknown>;

    if (status === 'success' || status === 'completed') {
      return { type: 'payment.succeeded', userId, data };
    }
    if (status === 'failed' || status === 'error') {
      return { type: 'payment.failed', userId, data };
    }
    return { type: 'subscription.created', userId, data };
  }
}
