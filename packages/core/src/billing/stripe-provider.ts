/**
 * Stripe payment provider adapter.
 * Uses Stripe Checkout for subscription creation — Stripe handles PCI compliance.
 * Webhook signature is verified via stripe.webhooks.constructEvent.
 */

import Stripe from 'stripe';
import type { BillingPlan, PaymentIntent } from '@fhirbridge/types';
import type { PaymentProviderAdapter, WebhookEvent } from './payment-provider-interface.js';

export class StripeProvider implements PaymentProviderAdapter {
  readonly name = 'stripe' as const;

  private readonly stripe: Stripe;
  private readonly webhookSecret: string;

  constructor(secretKey: string, webhookSecret: string) {
    this.stripe = new Stripe(secretKey);
    this.webhookSecret = webhookSecret;
  }

  async createSubscription(userId: string, plan: BillingPlan): Promise<PaymentIntent> {
    // Create a Checkout Session — user is redirected to Stripe-hosted page.
    // No card details touch our servers.
    const session = await this.stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            unit_amount: plan.pricePerMonth,
            recurring: { interval: 'month' },
            product_data: { name: `FHIRBridge ${plan.tier} plan` },
          },
          quantity: 1,
        },
      ],
      metadata: { userId, tier: plan.tier },
      success_url: process.env['STRIPE_SUCCESS_URL'] ?? 'https://fhirbridge.app/billing/success',
      cancel_url: process.env['STRIPE_CANCEL_URL'] ?? 'https://fhirbridge.app/billing/cancel',
    });

    return {
      id: session.id,
      provider: 'stripe',
      amount: plan.pricePerMonth,
      currency: 'usd',
      status: 'pending',
      metadata: {
        checkoutUrl: session.url ?? '',
        userId,
        tier: plan.tier,
      },
    };
  }

  async cancelSubscription(subscriptionId: string): Promise<void> {
    await this.stripe.subscriptions.cancel(subscriptionId);
  }

  async getSubscriptionStatus(
    subscriptionId: string,
  ): Promise<'active' | 'cancelled' | 'past_due'> {
    const sub = await this.stripe.subscriptions.retrieve(subscriptionId);
    if (sub.status === 'active') return 'active';
    if (sub.status === 'past_due') return 'past_due';
    return 'cancelled';
  }

  async handleWebhook(payload: unknown, signature: string): Promise<WebhookEvent> {
    let event: Stripe.Event;
    try {
      event = this.stripe.webhooks.constructEvent(
        payload as string | Buffer,
        signature,
        this.webhookSecret,
      );
    } catch (err) {
      throw new Error(`Stripe webhook signature verification failed: ${String(err)}`);
    }

    return mapStripeEvent(event);
  }
}

/** Map a Stripe event to the provider-agnostic WebhookEvent shape */
function mapStripeEvent(event: Stripe.Event): WebhookEvent {
  const data = event.data.object as unknown as Record<string, unknown>;
  const userId = (data['metadata'] as Record<string, string> | undefined)?.['userId'] ?? '';

  switch (event.type) {
    case 'customer.subscription.created':
      return { type: 'subscription.created', userId, data };
    case 'customer.subscription.deleted':
      return { type: 'subscription.cancelled', userId, data };
    case 'invoice.payment_succeeded':
      return { type: 'payment.succeeded', userId, data };
    case 'invoice.payment_failed':
      return { type: 'payment.failed', userId, data };
    default:
      return { type: 'payment.succeeded', userId, data };
  }
}
