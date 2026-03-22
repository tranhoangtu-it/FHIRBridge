/**
 * Payment provider abstraction.
 * Concrete adapters (Stripe, SePay) implement PaymentProviderAdapter.
 * No card/bank details are stored — providers handle PCI compliance.
 */

import type { BillingPlan, PaymentIntent, PaymentProvider } from '@fhirbridge/types';

/** Webhook event emitted after provider processes a payment lifecycle event */
export interface WebhookEvent {
  type: 'subscription.created' | 'subscription.cancelled' | 'payment.succeeded' | 'payment.failed';
  userId: string;
  data: Record<string, unknown>;
}

/** Contract that all payment provider adapters must satisfy */
export interface PaymentProviderAdapter {
  readonly name: PaymentProvider;

  /**
   * Create a subscription checkout session.
   * Returns a PaymentIntent containing the redirect URL in metadata.checkoutUrl.
   */
  createSubscription(userId: string, plan: BillingPlan): Promise<PaymentIntent>;

  /** Cancel an active subscription by its provider-side subscription ID */
  cancelSubscription(subscriptionId: string): Promise<void>;

  /** Return the current status of a subscription */
  getSubscriptionStatus(subscriptionId: string): Promise<'active' | 'cancelled' | 'past_due'>;

  /**
   * Parse and verify a provider webhook payload.
   * Throws if signature verification fails.
   */
  handleWebhook(payload: unknown, signature: string): Promise<WebhookEvent>;
}
