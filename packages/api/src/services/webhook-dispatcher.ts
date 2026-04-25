/**
 * WebhookDispatcher — gửi webhook events tới subscriber URLs.
 *
 * Pattern theo Stripe:
 * - Signature header: X-FHIRBridge-Signature: t=<timestamp>,v1=<hmac>
 * - HMAC-SHA256(timestamp + '.' + body, webhookSecret)
 *
 * Retry policy: exponential backoff 1s/2s/4s/8s/16s, tối đa 5 retries.
 * setTimeout với .unref() để không block process exit.
 * In-flight retries được track trong Map keyed `sub.id+event.id`.
 */

import { createHmac } from 'node:crypto';
import type { WebhookSubscription, WebhookEventType } from './webhook-subscription-store.js';
import type { WebhookSubscriptionStore } from './webhook-subscription-store.js';
import { validateBaseUrl } from '@fhirbridge/core';

/** Event envelope — Stripe-inspired */
export interface WebhookEvent {
  /** evt_<uuid> — idempotency key */
  id: string;
  type: WebhookEventType;
  /** Unix timestamp (seconds) */
  created: number;
  api_version: 'v1';
  data: WebhookEventData;
}

/** Data payload theo event type */
export type WebhookEventData = ExportCompletedData | ExportFailedData | SummaryCompletedData;

export interface ExportCompletedData {
  export_id: string;
  /** HMAC-SHA256 hash của user ID — không log raw */
  user_id_hash: string;
  resource_count: number;
  duration_ms: number;
  download_url: string;
}

export interface ExportFailedData {
  export_id: string;
  user_id_hash: string;
  error: string;
  duration_ms: number;
}

export interface SummaryCompletedData {
  summary_id: string;
  user_id_hash: string;
  language: string;
  duration_ms: number;
}

/** Logger interface — tương thích với Fastify logger và console */
export interface WebhookLogger {
  info(msg: string, ...args: unknown[]): void;
  warn(msg: string, ...args: unknown[]): void;
  error(msg: string, ...args: unknown[]): void;
}

/** Backoff delays (ms) cho mỗi attempt index 0..4 */
const BACKOFF_MS = [1000, 2000, 4000, 8000, 16000] as const;

/** Tổng số lần thử = 1 lần đầu + 5 lần retry */
const MAX_ATTEMPTS = 6;

/** Timeout cho mỗi HTTP request (ms) */
const DELIVERY_TIMEOUT_MS = 10_000;

/**
 * Tính HMAC-SHA256 signature theo Stripe pattern.
 * payload = timestamp + '.' + body
 */
function computeSignature(timestamp: number, body: string, secret: string): string {
  const payload = `${timestamp}.${body}`;
  return createHmac('sha256', secret).update(payload, 'utf8').digest('hex');
}

export class WebhookDispatcher {
  /**
   * Track in-flight retry timers để có thể cancel khi shutdown.
   * Key = `${sub.id}:${event.id}`, value = NodeJS.Timeout handle
   */
  private readonly inFlight = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(
    private readonly subStore: WebhookSubscriptionStore,
    private readonly logger: WebhookLogger,
  ) {}

  /**
   * Dispatch event tới tất cả matching subscriptions của userId.
   * Fire-and-forget — không await delivery.
   */
  async dispatch(event: WebhookEvent, userId: string): Promise<void> {
    const subs = this.subStore.findByUserId(userId);
    // Filter: active + subscribed to this event type
    const matching = subs.filter((s) => s.active && s.events.includes(event.type));

    for (const sub of matching) {
      // Kick off first attempt — không await để không block caller
      void this.attemptDelivery(sub, event, 0);
    }
  }

  /**
   * Thực hiện một lần POST tới subscriber URL.
   * Tự schedule retry với backoff khi thất bại.
   *
   * @param sub - Subscription record (lấy snapshot tại thời điểm dispatch)
   * @param event - Event envelope cần gửi
   * @param attempt - Index của lần thử (0 = lần đầu, 1..5 = retries)
   */
  private async attemptDelivery(
    sub: WebhookSubscription,
    event: WebhookEvent,
    attempt: number,
  ): Promise<void> {
    // SSRF re-validate — URL có thể thay đổi nếu store bị corrupt
    const ssrfResult = validateBaseUrl(sub.url);
    if (!ssrfResult.ok) {
      this.logger.error(
        `[WebhookDispatcher] SSRF validation failed for sub ${sub.id}: ${ssrfResult.reason}`,
      );
      return; // Không retry — URL nguy hiểm
    }

    const body = JSON.stringify(event);
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = computeSignature(timestamp, body, sub.secret);
    const signatureHeader = `t=${timestamp},v1=${signature}`;

    let success = false;
    let statusCode: number | undefined;

    try {
      const controller = new AbortController();
      // Timeout để không block thread vô thời hạn
      const timeoutId = setTimeout(() => {
        controller.abort();
      }, DELIVERY_TIMEOUT_MS);
      // unref() để không block process exit
      timeoutId.unref();

      const response = await fetch(sub.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-FHIRBridge-Signature': signatureHeader,
          'User-Agent': 'FHIRBridge-Webhook/1.0',
        },
        body,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      statusCode = response.status;
      success = response.ok; // 2xx = success
    } catch (err) {
      // Network error hoặc timeout
      const errMsg = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `[WebhookDispatcher] sub=${sub.id} event=${event.id} attempt=${attempt} network_error=${errMsg}`,
      );
    }

    if (success) {
      this.logger.info(
        `[WebhookDispatcher] delivered sub=${sub.id} event=${event.id} status=${statusCode ?? '?'}`,
      );
      // Xóa tracking key khi thành công
      this.inFlight.delete(`${sub.id}:${event.id}`);
      return;
    }

    this.logger.warn(
      `[WebhookDispatcher] failed sub=${sub.id} event=${event.id} attempt=${attempt} status=${statusCode ?? 'network_error'}`,
    );

    // Kiểm tra còn retry không (attempt 0..MAX_ATTEMPTS-2 = còn có thể retry)
    if (attempt >= MAX_ATTEMPTS - 1) {
      this.logger.error(
        `[WebhookDispatcher] final_failure sub=${sub.id} event=${event.id} after ${MAX_ATTEMPTS} attempts — dropping`,
      );
      this.inFlight.delete(`${sub.id}:${event.id}`);
      return;
    }

    // Schedule retry với exponential backoff
    const delayMs = BACKOFF_MS[attempt] ?? BACKOFF_MS[BACKOFF_MS.length - 1]!;
    const trackKey = `${sub.id}:${event.id}`;

    const timer = setTimeout(() => {
      this.inFlight.delete(trackKey);
      void this.attemptDelivery(sub, event, attempt + 1);
    }, delayMs);

    // unref() quan trọng: không block process.exit khi có pending retries
    timer.unref();

    this.inFlight.set(trackKey, timer);

    this.logger.info(
      `[WebhookDispatcher] scheduled_retry sub=${sub.id} event=${event.id} attempt=${attempt + 1} delay=${delayMs}ms`,
    );
  }

  /**
   * Trả về số lượng in-flight retry timers hiện tại.
   * Dùng cho test/monitoring.
   */
  pendingCount(): number {
    return this.inFlight.size;
  }
}
