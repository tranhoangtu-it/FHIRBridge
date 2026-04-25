/**
 * Tests for SepayProvider adapter.
 * Uses real HMAC-SHA256 (built-in crypto) — no external service calls.
 * Bao gồm tests cho replay protection (H-2): timestamp window + nonce dedup.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createHmac } from 'crypto';
import { SepayProvider } from '../sepay-provider.js';
import { InMemoryNonceStore } from '../webhook-nonce-store.js';
import type { INonceStore } from '../webhook-nonce-store.js';
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

/** Tạo provider với InMemoryNonceStore dừng eviction (tránh timer leak trong test) */
function buildProvider(nonceStore?: INonceStore) {
  const store = nonceStore ?? new InMemoryNonceStore();
  return { provider: new SepayProvider(API_KEY, BASE_URL, store), store };
}

/** Build valid HMAC-SHA256 signature theo scheme SePay */
function signPayload(orderId: string, amount: number, status: string): string {
  const message = `${orderId}${amount}${status}`;
  return createHmac('sha256', API_KEY).update(message).digest('hex');
}

/** Epoch seconds "now" */
function nowSecs(): number {
  return Math.floor(Date.now() / 1000);
}

/** Payload đầy đủ với timestamp + transactionId (cho replay tests) */
function buildPayload(
  overrides?: Partial<{
    orderId: string;
    userId: string;
    amount: number;
    status: string;
    timestamp: number;
    transactionId: string;
  }>,
) {
  const base = {
    orderId: 'order-001',
    userId: 'user-001',
    amount: 1900,
    status: 'success',
    timestamp: nowSecs(),
    transactionId: 'txn-001',
    ...overrides,
  };
  return { payload: base, signature: signPayload(base.orderId, base.amount, base.status) };
}

// ── Suite ──────────────────────────────────────────────────────────────────────

describe('SepayProvider', () => {
  let nonceStore: InMemoryNonceStore;

  beforeEach(() => {
    nonceStore = new InMemoryNonceStore();
  });

  afterEach(() => {
    // Dừng eviction timer sau mỗi test để tránh leak
    nonceStore.stopEviction();
  });

  // ── Interface compliance ─────────────────────────────────────────────────────

  describe('interface compliance', () => {
    it('has name "sepay"', () => {
      const { provider } = buildProvider(nonceStore);
      expect(provider.name).toBe('sepay');
    });

    it('implements PaymentProviderAdapter interface', () => {
      const { provider } = buildProvider(nonceStore);
      const adapter = provider as PaymentProviderAdapter;
      expect(typeof adapter.createSubscription).toBe('function');
      expect(typeof adapter.cancelSubscription).toBe('function');
      expect(typeof adapter.getSubscriptionStatus).toBe('function');
      expect(typeof adapter.handleWebhook).toBe('function');
    });
  });

  // ── createSubscription() ─────────────────────────────────────────────────────

  describe('createSubscription()', () => {
    it('returns a PaymentIntent with sepay provider and pending status', async () => {
      const { provider } = buildProvider(nonceStore);
      const intent = await provider.createSubscription('user-abc123', PLAN);

      expect(intent.provider).toBe('sepay');
      expect(intent.status).toBe('pending');
      expect(intent.currency).toBe('vnd');
      expect(intent.amount).toBe(1900);
    });

    it('generates a non-empty payment URL in metadata', async () => {
      const { provider } = buildProvider(nonceStore);
      const intent = await provider.createSubscription('user-abc123', PLAN);

      const checkoutUrl = intent.metadata?.['checkoutUrl'] as string;
      expect(typeof checkoutUrl).toBe('string');
      expect(checkoutUrl.length).toBeGreaterThan(0);
      expect(checkoutUrl).toContain('http');
    });

    it('embeds userId and tier in metadata', async () => {
      const { provider } = buildProvider(nonceStore);
      const intent = await provider.createSubscription('user-abc123', PLAN);

      expect(intent.metadata?.['userId']).toBe('user-abc123');
      expect(intent.metadata?.['tier']).toBe('starter');
    });

    it('generates an orderId that encodes the userId prefix and timestamp', async () => {
      const { provider } = buildProvider(nonceStore);
      const intent = await provider.createSubscription('user-abc123', PLAN);
      // orderId format: FB-{userId[0..8]}-{timestamp}
      expect(intent.id).toMatch(/^FB-user-abc-\d+$/);
    });
  });

  // ── handleWebhook() — signature ──────────────────────────────────────────────

  describe('handleWebhook() — signature verification', () => {
    it('accepts valid HMAC-SHA256 signature with fresh timestamp and new nonce', async () => {
      const { provider } = buildProvider(nonceStore);
      const { payload, signature } = buildPayload();

      const event = await provider.handleWebhook(payload, signature);

      expect(event.type).toBe('payment.succeeded');
      expect(event.userId).toBe('user-001');
    });

    it('throws on invalid (tampered) signature — timing-safe path', async () => {
      const { provider } = buildProvider(nonceStore);
      const { payload } = buildPayload();

      await expect(provider.handleWebhook(payload, 'invalid-signature')).rejects.toThrow(
        'SePay webhook signature verification failed',
      );
    });

    it('throws when payload is tampered (amount changed)', async () => {
      const { provider } = buildProvider(nonceStore);
      const { payload, signature } = buildPayload({ amount: 1900 });

      // Tamper: change amount after signing
      const tamperedPayload = { ...payload, amount: 0 };

      await expect(provider.handleWebhook(tamperedPayload, signature)).rejects.toThrow(
        'SePay webhook signature verification failed',
      );
    });

    it('returns payment.failed event for failed status', async () => {
      const { provider } = buildProvider(nonceStore);
      const { payload, signature } = buildPayload({
        orderId: 'order-002',
        userId: 'user-002',
        status: 'failed',
        transactionId: 'txn-002',
      });

      const event = await provider.handleWebhook(payload, signature);
      expect(event.type).toBe('payment.failed');
    });
  });

  // ── handleWebhook() — timestamp window (H-2) ─────────────────────────────────

  describe('handleWebhook() — timestamp window', () => {
    it('rejects webhook với timestamp quá cũ (> 5 phút)', async () => {
      const { provider } = buildProvider(nonceStore);
      // 6 phút trước → ngoài window
      const staleTs = nowSecs() - 6 * 60;
      const { payload, signature } = buildPayload({
        timestamp: staleTs,
        transactionId: 'txn-stale',
      });

      const rejection = provider.handleWebhook(payload, signature);

      await expect(rejection).rejects.toThrow('SePay webhook timestamp expired');
      await expect(rejection).rejects.toMatchObject({ code: 'webhook_timestamp_expired' });
    });

    it('rejects webhook với timestamp trong tương lai quá xa (> 5 phút)', async () => {
      const { provider } = buildProvider(nonceStore);
      // 6 phút trong tương lai
      const futureTs = nowSecs() + 6 * 60;
      const { payload, signature } = buildPayload({
        timestamp: futureTs,
        transactionId: 'txn-future',
      });

      await expect(provider.handleWebhook(payload, signature)).rejects.toMatchObject({
        code: 'webhook_timestamp_expired',
      });
    });

    it('accepts webhook với timestamp gần đây (< 5 phút)', async () => {
      const { provider } = buildProvider(nonceStore);
      // 4 phút trước → trong window
      const recentTs = nowSecs() - 4 * 60;
      const { payload, signature } = buildPayload({
        timestamp: recentTs,
        transactionId: 'txn-recent',
      });

      const event = await provider.handleWebhook(payload, signature);
      expect(event.type).toBe('payment.succeeded');
    });

    it('throws khi thiếu timestamp field', async () => {
      const { provider } = buildProvider(nonceStore);
      const { payload, signature } = buildPayload();
      // Xóa timestamp field
      const { timestamp: _ts, ...payloadWithoutTs } = payload;

      await expect(provider.handleWebhook(payloadWithoutTs, signature)).rejects.toThrow(
        'SePay webhook timestamp missing',
      );
    });
  });

  // ── handleWebhook() — nonce dedup (H-2) ──────────────────────────────────────

  describe('handleWebhook() — nonce dedup / replay protection', () => {
    it('chấp nhận webhook đầu tiên với nonce mới', async () => {
      const { provider } = buildProvider(nonceStore);
      const { payload, signature } = buildPayload({ transactionId: 'txn-unique-001' });

      const event = await provider.handleWebhook(payload, signature);
      expect(event.type).toBe('payment.succeeded');
    });

    it('reject replay: cùng transactionId gửi lần 2', async () => {
      const { provider } = buildProvider(nonceStore);
      const { payload, signature } = buildPayload({ transactionId: 'txn-replay-001' });

      // Lần đầu → OK
      await provider.handleWebhook(payload, signature);

      // Lần hai → replay
      const rejection = provider.handleWebhook(payload, signature);
      await expect(rejection).rejects.toThrow('SePay webhook replay detected');
      await expect(rejection).rejects.toMatchObject({ code: 'webhook_replay_detected' });
    });

    it('cho phép cùng transactionId sau khi nonce hết hạn (TTL expiry)', async () => {
      // Tạo store với TTL rất ngắn để test expiry
      const shortTtlStore = new InMemoryNonceStore(100); // evict mỗi 100ms

      // Ghi nonce với TTL 1ms (đã hết hạn gần như ngay lập tức)
      await shortTtlStore.recordFirstSeen('sepay:txn-expire-001', 1);

      // Chờ TTL hết hạn
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Ghi lại → lần này phải trả về true (first-seen sau expiry)
      const isFirstSeen = await shortTtlStore.recordFirstSeen('sepay:txn-expire-001', 60_000);
      expect(isFirstSeen).toBe(true);

      shortTtlStore.stopEviction();
    });

    it('hai transactionId khác nhau → cả hai đều được chấp nhận', async () => {
      const { provider } = buildProvider(nonceStore);
      const { payload: p1, signature: s1 } = buildPayload({ transactionId: 'txn-A' });
      const { payload: p2, signature: s2 } = buildPayload({ transactionId: 'txn-B' });

      const [e1, e2] = await Promise.all([
        provider.handleWebhook(p1, s1),
        provider.handleWebhook(p2, s2),
      ]);

      expect(e1.type).toBe('payment.succeeded');
      expect(e2.type).toBe('payment.succeeded');
    });

    it('bỏ qua nonce check khi transactionId không có trong payload', async () => {
      const { provider } = buildProvider(nonceStore);
      // Payload hợp lệ nhưng không có transactionId
      const basePayload = {
        orderId: 'order-no-txn',
        userId: 'user-001',
        amount: 1900,
        status: 'success',
        timestamp: nowSecs(),
        // transactionId: bị bỏ
      };
      const signature = signPayload(basePayload.orderId, basePayload.amount, basePayload.status);

      // Phải accept (không throw replay error khi không có transactionId)
      const event = await provider.handleWebhook(basePayload, signature);
      expect(event.type).toBe('payment.succeeded');
    });
  });

  // ── cancelSubscription() ─────────────────────────────────────────────────────

  describe('cancelSubscription()', () => {
    it('resolves without error (no-op for bank transfer model)', async () => {
      const { provider } = buildProvider(nonceStore);
      await expect(provider.cancelSubscription('sub-001')).resolves.toBeUndefined();
    });
  });

  // ── getSubscriptionStatus() ──────────────────────────────────────────────────

  describe('getSubscriptionStatus()', () => {
    it('returns "active" (SePay does not track subscription lifecycle)', async () => {
      const { provider } = buildProvider(nonceStore);
      const status = await provider.getSubscriptionStatus('sub-001');
      expect(status).toBe('active');
    });
  });
});
