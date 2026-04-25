/**
 * Webhook nonce store — dùng để chống replay attack.
 * INonceStore là interface, InMemoryNonceStore là implementation mặc định.
 *
 * PRODUCTION NOTE (Sprint 2): InMemoryNonceStore KHÔNG multi-replica safe.
 * Khi deploy nhiều instance API cần swap qua RedisNonceStore
 * dùng SET NX với TTL để đảm bảo atomicity across replicas.
 */

/**
 * Giao diện store dùng để ghi nhận và kiểm tra nonce đã thấy hay chưa.
 * Mỗi nonce chỉ được chấp nhận đúng một lần trong khoảng TTL.
 */
export interface INonceStore {
  /**
   * Ghi nhận nonce lần đầu tiên thấy.
   * @returns true nếu nonce CHƯA từng seen (first-seen = hợp lệ)
   *          false nếu đã seen (replay = reject)
   */
  recordFirstSeen(nonce: string, ttlMs: number): Promise<boolean>;
}

/** Entry lưu trong Map: thời điểm expiry (epoch ms) */
interface NonceEntry {
  expiresAt: number;
}

/**
 * In-memory implementation của INonceStore.
 * Tự evict các entry hết hạn mỗi 60 giây để tránh memory leak.
 *
 * WARNING: không dùng được trong môi trường multi-replica.
 * Swap qua RedisNonceStore khi scale horizontal.
 */
export class InMemoryNonceStore implements INonceStore {
  private readonly store = new Map<string, NonceEntry>();
  private readonly evictionIntervalMs: number;
  private evictionTimer: ReturnType<typeof setInterval> | null = null;

  constructor(evictionIntervalMs = 60_000) {
    this.evictionIntervalMs = evictionIntervalMs;
    // Bắt đầu eviction loop
    this.startEviction();
  }

  async recordFirstSeen(nonce: string, ttlMs: number): Promise<boolean> {
    const now = Date.now();
    const existing = this.store.get(nonce);

    // Nếu entry tồn tại và chưa hết hạn → đây là replay
    if (existing !== undefined && existing.expiresAt > now) {
      return false;
    }

    // Ghi nhận lần đầu (hoặc ghi đè entry đã hết hạn)
    this.store.set(nonce, { expiresAt: now + ttlMs });
    return true;
  }

  /** Xóa tất cả entry đã hết hạn để tránh memory leak */
  private evict(): void {
    const now = Date.now();
    for (const [key, entry] of this.store) {
      if (entry.expiresAt <= now) {
        this.store.delete(key);
      }
    }
  }

  private startEviction(): void {
    // unref() để timer không giữ process alive khi không còn việc cần làm
    this.evictionTimer = setInterval(() => {
      this.evict();
    }, this.evictionIntervalMs);

    if (this.evictionTimer.unref) {
      this.evictionTimer.unref();
    }
  }

  /** Dừng eviction timer — dùng trong tests để tránh leak */
  stopEviction(): void {
    if (this.evictionTimer !== null) {
      clearInterval(this.evictionTimer);
      this.evictionTimer = null;
    }
  }
}
