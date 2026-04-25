/**
 * WebhookSubscriptionStore — in-memory store cho webhook subscriptions.
 * Keyed by subscription ID (sub_<uuid>).
 *
 * Production v1.2: swap sang Postgres-backed implementation,
 * giữ interface này không đổi để caller không cần update.
 */

import { randomBytes, randomUUID } from 'node:crypto';

/** Các event type mà webhook có thể subscribe */
export type WebhookEventType = 'export.completed' | 'export.failed' | 'summary.completed';

/** Subscription record — không chứa PHI */
export interface WebhookSubscription {
  /** sub_<uuid> */
  id: string;
  /** ID của user sở hữu subscription — dùng cho ownership check */
  userId: string;
  /** URL đích — đã qua SSRF validation khi tạo */
  url: string;
  /** Danh sách event types mà sub này nhận */
  events: WebhookEventType[];
  /** HMAC secret — 32 bytes hex — trả cho client 1 lần khi tạo, không lấy lại được */
  secret: string;
  /** ISO timestamp */
  createdAt: string;
  /** Soft-delete via active flag */
  active: boolean;
}

/** Payload trả về khi tạo mới — bao gồm secret (1-time) */
export interface CreateSubscriptionResult {
  id: string;
  url: string;
  events: WebhookEventType[];
  secret: string;
  createdAt: string;
}

export class WebhookSubscriptionStore {
  private readonly store = new Map<string, WebhookSubscription>();

  /**
   * Tạo subscription mới.
   * Secret được generate ngẫu nhiên 32 bytes hex — chỉ trả về 1 lần.
   */
  create(userId: string, url: string, events: WebhookEventType[]): CreateSubscriptionResult {
    const id = `sub_${randomUUID()}`;
    // 32 bytes = 256-bit entropy — đủ mạnh cho HMAC-SHA256
    const secret = randomBytes(32).toString('hex');
    const createdAt = new Date().toISOString();

    const sub: WebhookSubscription = {
      id,
      userId,
      url,
      events,
      secret,
      createdAt,
      active: true,
    };

    this.store.set(id, sub);

    return { id, url, events, secret, createdAt };
  }

  /**
   * Lấy subscription theo ID.
   * Không check ownership — caller tự enforce nếu cần.
   */
  findById(id: string): WebhookSubscription | undefined {
    return this.store.get(id);
  }

  /**
   * Lấy tất cả active subscriptions của một user.
   * Dùng để dispatch events và list API.
   */
  findByUserId(userId: string): WebhookSubscription[] {
    const result: WebhookSubscription[] = [];
    for (const sub of this.store.values()) {
      if (sub.userId === userId && sub.active) {
        result.push(sub);
      }
    }
    return result;
  }

  /**
   * Xóa subscription (hard delete).
   * Trả false nếu không tìm thấy hoặc userId không khớp (IDOR protection).
   */
  delete(id: string, userId: string): boolean {
    const sub = this.store.get(id);
    // Ownership check: không để lộ 403 timing — trả false cho cả not-found và not-owner
    if (!sub || sub.userId !== userId) return false;
    this.store.delete(id);
    return true;
  }

  /** Trả về tổng số subscriptions (dùng cho test/debug) */
  size(): number {
    return this.store.size;
  }
}
