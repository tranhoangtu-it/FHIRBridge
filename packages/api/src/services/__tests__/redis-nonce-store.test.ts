/**
 * RedisNonceStore unit tests.
 * Dùng mock Redis object — không cần kết nối Redis thực.
 * Kiểm tra: first-seen, replay, TTL expiry semantics, isolation, error propagation.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RedisNonceStore } from '../redis-nonce-store.js';
import type { Redis } from 'ioredis';

// ── Mock Redis helper ──────────────────────────────────────────────────────────

/** Tạo mock Redis với SET NX behavior có thể control */
function makeMockRedis(responses: Map<string, string | null>) {
  return {
    set: vi.fn(
      async (
        key: string,
        _value: string,
        _exFlag: string,
        _ttl: number,
        nxFlag: string,
      ): Promise<string | null> => {
        if (nxFlag !== 'NX') return 'OK';
        // Simulate NX: chỉ set nếu key chưa trong store
        if (responses.has(key)) return null; // key đã tồn tại → replay
        responses.set(key, '1');
        return 'OK'; // first-seen
      },
    ),
  } as unknown as Redis;
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('RedisNonceStore', () => {
  let store: RedisNonceStore;
  let redisState: Map<string, string | null>;
  let mockRedis: Redis;

  beforeEach(() => {
    redisState = new Map();
    mockRedis = makeMockRedis(redisState);
    store = new RedisNonceStore(mockRedis);
  });

  it('first call trả true (first-seen)', async () => {
    const result = await store.recordFirstSeen('nonce-abc', 5000);
    expect(result).toBe(true);
  });

  it('second call với cùng nonce trả false (replay)', async () => {
    await store.recordFirstSeen('nonce-abc', 5000);
    const replay = await store.recordFirstSeen('nonce-abc', 5000);
    expect(replay).toBe(false);
  });

  it('nonces khác nhau được isolated (không ảnh hưởng nhau)', async () => {
    const r1 = await store.recordFirstSeen('nonce-1', 5000);
    const r2 = await store.recordFirstSeen('nonce-2', 5000);
    expect(r1).toBe(true);
    expect(r2).toBe(true);
  });

  it('TTL expiry: sau khi key bị xóa khỏi store, nonce được chấp nhận lại', async () => {
    await store.recordFirstSeen('expired-nonce', 1000);
    // Simulate TTL expiry: xóa key khỏi mock state
    redisState.delete('nonce:expired-nonce');
    const reAccepted = await store.recordFirstSeen('expired-nonce', 1000);
    expect(reAccepted).toBe(true);
  });

  it('TTL được chuyển đổi đúng (ms → giây, Math.ceil)', async () => {
    const captureSpy = vi.fn().mockResolvedValue('OK');
    const spyRedis = { set: captureSpy } as unknown as Redis;
    const spyStore = new RedisNonceStore(spyRedis);

    // 500ms → ceil(0.5) = 1 giây
    await spyStore.recordFirstSeen('nonce-ttl', 500);
    expect(captureSpy).toHaveBeenCalledWith('nonce:nonce-ttl', '1', 'EX', 1, 'NX');

    // 3600000ms → 3600 giây
    await spyStore.recordFirstSeen('nonce-hour', 3_600_000);
    expect(captureSpy).toHaveBeenCalledWith('nonce:nonce-hour', '1', 'EX', 3600, 'NX');
  });

  it('Redis error propagates — không silent-fail', async () => {
    const errorRedis = {
      set: vi.fn().mockRejectedValue(new Error('Redis connection lost')),
    } as unknown as Redis;
    const errorStore = new RedisNonceStore(errorRedis);

    await expect(errorStore.recordFirstSeen('nonce-err', 5000)).rejects.toThrow(
      'Redis connection lost',
    );
  });

  it('custom prefix được áp dụng vào key', async () => {
    const captureSpy = vi.fn().mockResolvedValue('OK');
    const prefixRedis = { set: captureSpy } as unknown as Redis;
    const prefixStore = new RedisNonceStore(prefixRedis, 'webhook:nonce:');

    await prefixStore.recordFirstSeen('abc123', 5000);
    expect(captureSpy).toHaveBeenCalledWith('webhook:nonce:abc123', '1', 'EX', 5, 'NX');
  });
});
