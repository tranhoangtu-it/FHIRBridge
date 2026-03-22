/**
 * Tests for SepayProvider adapter.
 * Uses real HMAC-SHA256 (built-in crypto) — no external service calls.
 */

import { describe, it, expect } from 'vitest';
import { createHmac } from 'crypto';
import { SepayProvider } from '../sepay-provider.js';
import type { BillingPlan } from '@fhirbridge/types';
import type { PaymentProviderAdapter } from '../payment-provider-interface.js';

// ── Fixtures ───────────────────────────────────────────────────────────────────

const API_KEY = 'test-api-key-12345';
const BASE_URL = 'https://my.sepay.vn/userapi';

const PLAN: BillingPlan = {
  tier: 'starter',
  pricePerMonth: 1900,
  exportQuota: 50,
  aiSummaryQuota: 10,
  overage: { exportCostCents: 20, aiSummaryCostCents: 10 },
};

function buildProvider() {
  return new SepayProvider(API_KEY, BASE_URL);
}

/** Build a valid HMAC-SHA256 signature matching SePay's scheme */
function signPayload(orderId: string, amount: number, status: string): string {
  const message = `${orderId}${amount}${status}`;
  return createHmac('sha256', API_KEY).update(message).digest('hex');
}

describe('SepayProvider', () => {
  describe('interface compliance', () => {
    it('has name "sepay"', () => {
      expect(buildProvider().name).toBe('sepay');
    });

    it('implements PaymentProviderAdapter interface', () => {
      const provider = buildProvider();
      const adapter = provider as PaymentProviderAdapter;
      expect(typeof adapter.createSubscription).toBe('function');
      expect(typeof adapter.cancelSubscription).toBe('function');
      expect(typeof adapter.getSubscriptionStatus).toBe('function');
      expect(typeof adapter.handleWebhook).toBe('function');
    });
  });

  describe('createSubscription()', () => {
    it('returns a PaymentIntent with sepay provider and pending status', async () => {
      const provider = buildProvider();
      const intent = await provider.createSubscription('user-abc123', PLAN);

      expect(intent.provider).toBe('sepay');
      expect(intent.status).toBe('pending');
      expect(intent.currency).toBe('vnd');
      expect(intent.amount).toBe(1900);
    });

    it('generates a non-empty payment URL in metadata', async () => {
      const provider = buildProvider();
      const intent = await provider.createSubscription('user-abc123', PLAN);

      const checkoutUrl = intent.metadata?.['checkoutUrl'] as string;
      expect(typeof checkoutUrl).toBe('string');
      expect(checkoutUrl.length).toBeGreaterThan(0);
      expect(checkoutUrl).toContain('http');
    });

    it('embeds userId and tier in metadata', async () => {
      const provider = buildProvider();
      const intent = await provider.createSubscription('user-abc123', PLAN);

      expect(intent.metadata?.['userId']).toBe('user-abc123');
      expect(intent.metadata?.['tier']).toBe('starter');
    });

    it('generates an orderId that encodes the userId prefix and timestamp', async () => {
      const provider = buildProvider();
      const intent = await provider.createSubscription('user-abc123', PLAN);
      // orderId format: FB-{userId[0..8]}-{timestamp}
      expect(intent.id).toMatch(/^FB-user-abc-\d+$/);
    });
  });

  describe('handleWebhook()', () => {
    it('accepts valid HMAC-SHA256 signature', async () => {
      const provider = buildProvider();
      const orderId = 'order-001';
      const amount = 1900;
      const status = 'success';
      const signature = signPayload(orderId, amount, status);

      const payload = { orderId, userId: 'user-001', amount, status };
      const event = await provider.handleWebhook(payload, signature);

      expect(event.type).toBe('payment.succeeded');
      expect(event.userId).toBe('user-001');
    });

    it('throws on invalid (tampered) signature', async () => {
      const provider = buildProvider();
      const payload = { orderId: 'order-001', userId: 'user-001', amount: 1900, status: 'success' };

      await expect(provider.handleWebhook(payload, 'invalid-signature')).rejects.toThrow(
        'SePay webhook signature verification failed',
      );
    });

    it('throws when payload is tampered (amount changed)', async () => {
      const provider = buildProvider();
      const orderId = 'order-001';
      const originalAmount = 1900;
      const status = 'success';

      // Sign with original amount
      const signature = signPayload(orderId, originalAmount, status);

      // Tamper: change amount
      const tamperedPayload = { orderId, userId: 'user-001', amount: 0, status };

      await expect(provider.handleWebhook(tamperedPayload, signature)).rejects.toThrow(
        'SePay webhook signature verification failed',
      );
    });

    it('returns payment.failed event for failed status', async () => {
      const provider = buildProvider();
      const orderId = 'order-002';
      const amount = 1900;
      const status = 'failed';
      const signature = signPayload(orderId, amount, status);

      const payload = { orderId, userId: 'user-002', amount, status };
      const event = await provider.handleWebhook(payload, signature);

      expect(event.type).toBe('payment.failed');
    });
  });

  describe('cancelSubscription()', () => {
    it('resolves without error (no-op for bank transfer model)', async () => {
      const provider = buildProvider();
      await expect(provider.cancelSubscription('sub-001')).resolves.toBeUndefined();
    });
  });

  describe('getSubscriptionStatus()', () => {
    it('returns "active" (SePay does not track subscription lifecycle)', async () => {
      const provider = buildProvider();
      const status = await provider.getSubscriptionStatus('sub-001');
      expect(status).toBe('active');
    });
  });
});
