/**
 * Tests for StripeProvider adapter.
 * Stubs Stripe SDK — no real HTTP calls.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { BillingPlan } from '@fhirbridge/types';
import type { PaymentProviderAdapter } from '../payment-provider-interface.js';

// ── Stripe SDK stub ────────────────────────────────────────────────────────────

const mockCheckoutSessionCreate = vi.fn();
const mockSubscriptionsCancel = vi.fn();
const mockSubscriptionsRetrieve = vi.fn();
const mockWebhooksConstructEvent = vi.fn();

vi.mock('stripe', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      checkout: {
        sessions: { create: mockCheckoutSessionCreate },
      },
      subscriptions: {
        cancel: mockSubscriptionsCancel,
        retrieve: mockSubscriptionsRetrieve,
      },
      webhooks: {
        constructEvent: mockWebhooksConstructEvent,
      },
    })),
  };
});

// ── Fixtures ───────────────────────────────────────────────────────────────────

const PLAN: BillingPlan = {
  tier: 'pro',
  pricePerMonth: 4900,
  exportQuota: 500,
  aiSummaryQuota: 100,
  overage: { exportCostCents: 10, aiSummaryCostCents: 5 },
};

// Lazy import after mock is registered
async function buildProvider() {
  const { StripeProvider } = await import('../stripe-provider.js');
  return new StripeProvider('sk_test_fake', 'whsec_fake');
}

describe('StripeProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('interface compliance', () => {
    it('has name "stripe"', async () => {
      const provider = await buildProvider();
      expect(provider.name).toBe('stripe');
    });

    it('implements PaymentProviderAdapter interface', async () => {
      const provider = await buildProvider();
      const adapter = provider as PaymentProviderAdapter;
      expect(typeof adapter.createSubscription).toBe('function');
      expect(typeof adapter.cancelSubscription).toBe('function');
      expect(typeof adapter.getSubscriptionStatus).toBe('function');
      expect(typeof adapter.handleWebhook).toBe('function');
    });
  });

  describe('createSubscription()', () => {
    it('returns a PaymentIntent with stripe provider and pending status', async () => {
      mockCheckoutSessionCreate.mockResolvedValue({
        id: 'cs_test_123',
        url: 'https://checkout.stripe.com/test',
      });

      const provider = await buildProvider();
      const intent = await provider.createSubscription('user-001', PLAN);

      expect(intent.provider).toBe('stripe');
      expect(intent.status).toBe('pending');
      expect(intent.amount).toBe(4900);
      expect(intent.currency).toBe('usd');
      expect(intent.metadata?.['checkoutUrl']).toBe('https://checkout.stripe.com/test');
    });

    it('throws when Stripe SDK raises an error (e.g. invalid API key)', async () => {
      mockCheckoutSessionCreate.mockRejectedValue(new Error('Invalid API Key'));

      const provider = await buildProvider();
      await expect(provider.createSubscription('user-001', PLAN)).rejects.toThrow(
        'Invalid API Key',
      );
    });
  });

  describe('handleWebhook()', () => {
    it('throws when signature verification fails', async () => {
      mockWebhooksConstructEvent.mockImplementation(() => {
        throw new Error('No signatures found matching the expected signature for payload');
      });

      const provider = await buildProvider();
      await expect(provider.handleWebhook(Buffer.from('payload'), 'bad-signature')).rejects.toThrow(
        'Stripe webhook signature verification failed',
      );
    });

    it('returns WebhookEvent on valid signature for subscription.created', async () => {
      mockWebhooksConstructEvent.mockReturnValue({
        type: 'customer.subscription.created',
        data: {
          object: { metadata: { userId: 'user-001' } },
        },
      });

      const provider = await buildProvider();
      const event = await provider.handleWebhook(Buffer.from('payload'), 't=1,v1=sig');

      expect(event.type).toBe('subscription.created');
      expect(event.userId).toBe('user-001');
    });
  });

  describe('cancelSubscription()', () => {
    it('calls Stripe cancel with correct subscription ID', async () => {
      mockSubscriptionsCancel.mockResolvedValue({});

      const provider = await buildProvider();
      await provider.cancelSubscription('sub_abc123');

      expect(mockSubscriptionsCancel).toHaveBeenCalledWith('sub_abc123');
    });
  });

  describe('getSubscriptionStatus()', () => {
    it('returns "active" for active subscription', async () => {
      mockSubscriptionsRetrieve.mockResolvedValue({ status: 'active' });

      const provider = await buildProvider();
      const status = await provider.getSubscriptionStatus('sub_abc123');
      expect(status).toBe('active');
    });

    it('returns "cancelled" for non-active, non-past_due subscription', async () => {
      mockSubscriptionsRetrieve.mockResolvedValue({ status: 'canceled' });

      const provider = await buildProvider();
      const status = await provider.getSubscriptionStatus('sub_abc123');
      expect(status).toBe('cancelled');
    });
  });
});
