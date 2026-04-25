/**
 * Redis-backed nonce store — multi-replica safe (dùng SET NX để atomic check).
 * Implements INonceStore từ @fhirbridge/core.
 *
 * Production note: chỉ cần set REDIS_URL env là active. Không cần code thay đổi.
 * Mỗi replica dùng cùng Redis → nonce seen ở replica A sẽ bị reject ở replica B.
 */

import type { Redis } from 'ioredis';
import type { INonceStore } from '@fhirbridge/core';

export class RedisNonceStore implements INonceStore {
  constructor(
    private readonly redis: Redis,
    private readonly prefix = 'nonce:',
  ) {}

  /**
   * Ghi nhận nonce lần đầu tiên thấy.
   * Dùng SET NX EX — atomic across replicas.
   *
   * @returns true nếu nonce CHƯA seen (first-seen = hợp lệ)
   *          false nếu đã seen (replay = reject)
   */
  async recordFirstSeen(nonce: string, ttlMs: number): Promise<boolean> {
    const key = this.prefix + nonce;
    // Math.ceil để đảm bảo TTL ít nhất 1 giây khi ttlMs < 1000
    const ttlSec = Math.ceil(ttlMs / 1000);

    // SET key value EX ttlSec NX — chỉ set nếu key chưa tồn tại
    // Trả 'OK' nếu set thành công (first-seen), null nếu key đã tồn tại (replay)
    const result = await this.redis.set(key, '1', 'EX', ttlSec, 'NX');
    return result === 'OK';
  }
}
