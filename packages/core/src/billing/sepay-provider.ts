/**
 * SePay payment provider adapter (Vietnam VietQR bank transfer).
 * SePay generates a VietQR payment URL — no card processing involved.
 * Webhook callback is verified via HMAC-SHA256 signature.
 *
 * Bảo mật webhook (H-2):
 * 1. Constant-time signature compare (chống timing attack)
 * 2. Timestamp window 5 phút (chống replay lâu dài)
 * 3. Nonce dedup (chống replay trong window)
 */

import { createHmac, timingSafeEqual } from 'crypto';
import type { BillingPlan, PaymentIntent } from '@fhirbridge/types';
import type { PaymentProviderAdapter, WebhookEvent } from './payment-provider-interface.js';
import { InMemoryNonceStore, type INonceStore } from './webhook-nonce-store.js';

/** Cửa sổ timestamp cho phép: ±5 phút */
const TIMESTAMP_WINDOW_MS = 5 * 60 * 1000; // 300_000 ms

/** TTL nonce: 10 phút — đủ rộng hơn timestamp window để cover mọi edge case */
const NONCE_TTL_MS = 10 * 60 * 1000; // 600_000 ms

/** SePay webhook callback payload shape */
interface SepayWebhookPayload {
  orderId?: string;
  userId?: string;
  amount?: number;
  status?: string;
  signature?: string;
  /** Epoch seconds — bắt buộc để kiểm tra timestamp window */
  timestamp?: number;
  /** Transaction ID duy nhất từ SePay — dùng làm nonce key */
  transactionId?: string;
  [key: string]: unknown;
}

export class SepayProvider implements PaymentProviderAdapter {
  readonly name = 'sepay' as const;

  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly nonceStore: INonceStore;

  constructor(
    apiKey: string,
    baseUrl = 'https://my.sepay.vn/userapi',
    // nonceStore optional — mặc định dùng InMemoryNonceStore
    // PRODUCTION NOTE (Sprint 2): swap qua RedisNonceStore khi multi-replica
    nonceStore?: INonceStore,
  ) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
    this.nonceStore = nonceStore ?? new InMemoryNonceStore();
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

    // ── 1. Verify HMAC-SHA256 signature (constant-time) ──────────────────────
    // Message: orderId + amount + status (giữ nguyên scheme cũ)
    const message = `${body['orderId'] ?? ''}${body['amount'] ?? ''}${body['status'] ?? ''}`;
    const expected = createHmac('sha256', this.apiKey).update(message).digest('hex');

    // timingSafeEqual yêu cầu cùng độ dài — nếu khác length thì chắc chắn sai
    const sigBuf = Buffer.from(signature, 'utf8');
    const expBuf = Buffer.from(expected, 'utf8');

    const sigValid = sigBuf.length === expBuf.length && timingSafeEqual(sigBuf, expBuf);

    if (!sigValid) {
      throw new Error('SePay webhook signature verification failed');
    }

    // ── 2. Timestamp window check ─────────────────────────────────────────────
    // SePay gửi timestamp dạng epoch seconds trong body
    const rawTs = body['timestamp'];
    if (rawTs === undefined || rawTs === null) {
      throw new Error('SePay webhook timestamp missing');
    }
    const timestampMs = Number(rawTs) * 1000; // epoch seconds → ms
    if (isNaN(timestampMs)) {
      throw new Error('SePay webhook timestamp invalid');
    }
    const ageMs = Math.abs(Date.now() - timestampMs);
    if (ageMs > TIMESTAMP_WINDOW_MS) {
      // Domain error code rõ ràng để caller có thể phân loại
      const err = new Error('SePay webhook timestamp expired') as Error & {
        code: string;
      };
      err.code = 'webhook_timestamp_expired';
      throw err;
    }

    // ── 3. Nonce dedup (chống replay trong window) ────────────────────────────
    const transactionId = body['transactionId'];
    if (transactionId !== undefined && transactionId !== null && transactionId !== '') {
      const nonceKey = `sepay:${String(transactionId)}`;
      const isFirstSeen = await this.nonceStore.recordFirstSeen(nonceKey, NONCE_TTL_MS);
      if (!isFirstSeen) {
        const err = new Error('SePay webhook replay detected') as Error & {
          code: string;
        };
        err.code = 'webhook_replay_detected';
        throw err;
      }
    }

    // ── 4. Map status → WebhookEvent ──────────────────────────────────────────
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
