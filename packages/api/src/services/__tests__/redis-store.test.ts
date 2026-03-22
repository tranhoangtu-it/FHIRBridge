/**
 * RedisStore unit tests.
 * Tests in-memory fallback behavior — no real Redis required.
 * TTL expiration and fallback on unavailable Redis are verified.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock ioredis to avoid needing a real Redis connection
vi.mock('ioredis', () => {
  const mockRedis = vi.fn().mockImplementation(() => ({
    on: vi.fn(),
    connect: vi.fn().mockRejectedValue(new Error('Connection refused')),
    quit: vi.fn().mockResolvedValue('OK'),
    disconnect: vi.fn(),
    set: vi.fn(),
    get: vi.fn().mockResolvedValue(null),
    del: vi.fn(),
  }));
  return { default: mockRedis };
});

import { RedisStore } from '../redis-store.js';

describe('RedisStore — in-memory fallback (no Redis)', () => {
  let store: RedisStore;

  beforeEach(() => {
    store = new RedisStore({ url: 'redis://localhost:9999', keyPrefix: 'test:' });
  });

  afterEach(async () => {
    await store.close();
  });

  it('set and get a value via in-memory fallback', async () => {
    await store.set('key1', { data: 'hello' }, 60);
    const val = await store.get<{ data: string }>('key1');
    expect(val).toEqual({ data: 'hello' });
  });

  it('returns undefined for missing key', async () => {
    const val = await store.get('missing-key');
    expect(val).toBeUndefined();
  });

  it('delete removes a key', async () => {
    await store.set('key2', 'value', 60);
    await store.delete('key2');
    const val = await store.get('key2');
    expect(val).toBeUndefined();
  });

  it('serializes and deserializes complex objects (JSON roundtrip)', async () => {
    const obj = {
      status: 'complete',
      bundle: { resourceType: 'Bundle', entry: [{ resource: { id: '1' } }] },
      resourceCount: 5,
      createdAt: 1234567890,
    };
    await store.set('complex', obj, 60);
    const result = await store.get<typeof obj>('complex');
    expect(result).toEqual(obj);
  });

  it('TTL expiration — expired entries return undefined', async () => {
    // Set entry with immediate expiry (0 seconds → already expired)
    await store.set('expired-key', 'stale', 0);
    // Force expiry by back-dating the entry
    // Access internal fallback map to simulate expiry
    const fallback = (
      store as unknown as { fallback: Map<string, { value: string; expiresAt: number }> }
    ).fallback;
    const entry = fallback.get('test:expired-key');
    if (entry) {
      entry.expiresAt = Date.now() - 1000; // Already expired
    }
    const val = await store.get('expired-key');
    expect(val).toBeUndefined();
  });

  it('key prefix is applied to all operations', async () => {
    await store.set('mykey', 42, 60);
    const fallback = (store as unknown as { fallback: Map<string, unknown> }).fallback;
    expect(fallback.has('test:mykey')).toBe(true);
    expect(fallback.has('mykey')).toBe(false);
  });

  it('isHealthy returns false when Redis unavailable', () => {
    // Redis connect() was rejected in mock — healthy should be false
    expect(store.isHealthy()).toBe(false);
  });
});

describe('RedisStore — multiple independent instances', () => {
  it('stores are isolated from each other', async () => {
    const storeA = new RedisStore({ url: 'redis://localhost:9999', keyPrefix: 'a:' });
    const storeB = new RedisStore({ url: 'redis://localhost:9999', keyPrefix: 'b:' });

    await storeA.set('shared-key', 'from-a', 60);
    await storeB.set('shared-key', 'from-b', 60);

    const valA = await storeA.get<string>('shared-key');
    const valB = await storeB.get<string>('shared-key');

    expect(valA).toBe('from-a');
    expect(valB).toBe('from-b');

    await storeA.close();
    await storeB.close();
  });
});
