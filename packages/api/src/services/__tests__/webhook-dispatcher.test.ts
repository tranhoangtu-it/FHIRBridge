/**
 * Tests cho WebhookDispatcher.
 * Coverage: dispatch filter, delivery success, retry on failure, final failure log.
 *
 * Dùng vi.useFakeTimers() để control setTimeout backoff mà không cần wait thật.
 * Fetch được stub bằng vi.stubGlobal().
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WebhookDispatcher } from '../webhook-dispatcher.js';
import { WebhookSubscriptionStore } from '../webhook-subscription-store.js';
import type { WebhookEvent } from '../webhook-dispatcher.js';

/**
 * Flush pending microtasks (Promise callbacks) bằng cách yield event loop nhiều lần.
 * Thay thế cho vi.runAllMicrotasksAsync() đã bị xóa trong Vitest 3.x.
 */
async function flushMicrotasks(): Promise<void> {
  // 5 lần yield đủ để Promise chains sâu 2-3 cấp hoàn thành
  for (let i = 0; i < 5; i++) {
    await Promise.resolve();
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────

function makeEvent(type: WebhookEvent['type'] = 'export.completed'): WebhookEvent {
  return {
    id: 'evt_test_001',
    type,
    created: 1_700_000_000,
    api_version: 'v1',
    data: {
      export_id: 'exp_abc',
      user_id_hash: 'deadbeef01234567',
      resource_count: 10,
      duration_ms: 500,
      download_url: 'https://api.fhirbridge.io/api/v1/export/exp_abc/download',
    },
  };
}

/** Tạo fetch mock trả về status cố định */
function mockFetch(status: number, ok?: boolean): ReturnType<typeof vi.fn> {
  return vi.fn().mockResolvedValue({
    status,
    ok: ok ?? (status >= 200 && status < 300),
  });
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('WebhookDispatcher', () => {
  let store: WebhookSubscriptionStore;
  let logger: {
    info: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
  };
  let dispatcher: WebhookDispatcher;

  beforeEach(() => {
    vi.useFakeTimers();
    store = new WebhookSubscriptionStore();
    logger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };
    dispatcher = new WebhookDispatcher(store, logger);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  // ── dispatch filtering ─────────────────────────────────────────────────

  it('không gọi fetch khi không có subscription nào', async () => {
    const fetchMock = mockFetch(200);
    vi.stubGlobal('fetch', fetchMock);

    await dispatcher.dispatch(makeEvent('export.completed'), 'user1');
    // Drain microtask queue
    await vi.runAllTimersAsync();

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('không dispatch tới subscription không subscribe event type này', async () => {
    const fetchMock = mockFetch(200);
    vi.stubGlobal('fetch', fetchMock);

    store.create('user1', 'https://example.com/hook', ['export.failed']);

    await dispatcher.dispatch(makeEvent('export.completed'), 'user1');
    await vi.runAllTimersAsync();

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('không dispatch tới subscription của user khác', async () => {
    const fetchMock = mockFetch(200);
    vi.stubGlobal('fetch', fetchMock);

    store.create('user2', 'https://example.com/hook', ['export.completed']);

    await dispatcher.dispatch(makeEvent('export.completed'), 'user1');
    await vi.runAllTimersAsync();

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('dispatch tới đúng subscription matching event type', async () => {
    const fetchMock = mockFetch(200);
    vi.stubGlobal('fetch', fetchMock);

    store.create('user1', 'https://example.com/hook', ['export.completed']);

    await dispatcher.dispatch(makeEvent('export.completed'), 'user1');
    await vi.runAllTimersAsync();

    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('dispatch tới nhiều subscriptions cùng lúc', async () => {
    const fetchMock = mockFetch(200);
    vi.stubGlobal('fetch', fetchMock);

    store.create('user1', 'https://a.com/hook', ['export.completed']);
    store.create('user1', 'https://b.com/hook', ['export.completed', 'export.failed']);

    await dispatcher.dispatch(makeEvent('export.completed'), 'user1');
    await vi.runAllTimersAsync();

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  // ── request format ──────────────────────────────────────────────────────

  it('gửi POST với Content-Type application/json', async () => {
    const fetchMock = mockFetch(200);
    vi.stubGlobal('fetch', fetchMock);

    store.create('user1', 'https://example.com/hook', ['export.completed']);
    await dispatcher.dispatch(makeEvent('export.completed'), 'user1');
    await vi.runAllTimersAsync();

    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((options.headers as Record<string, string>)['Content-Type']).toBe('application/json');
  });

  it('gửi X-FHIRBridge-Signature header với format t=...,v1=...', async () => {
    const fetchMock = mockFetch(200);
    vi.stubGlobal('fetch', fetchMock);

    store.create('user1', 'https://example.com/hook', ['export.completed']);
    await dispatcher.dispatch(makeEvent('export.completed'), 'user1');
    await vi.runAllTimersAsync();

    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    const sig = (options.headers as Record<string, string>)['X-FHIRBridge-Signature'];
    expect(sig).toMatch(/^t=\d+,v1=[0-9a-f]{64}$/);
  });

  it('body là JSON serialization của event envelope', async () => {
    const fetchMock = mockFetch(200);
    vi.stubGlobal('fetch', fetchMock);

    store.create('user1', 'https://example.com/hook', ['export.completed']);
    const event = makeEvent('export.completed');
    await dispatcher.dispatch(event, 'user1');
    await vi.runAllTimersAsync();

    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    const parsed = JSON.parse(options.body as string) as WebhookEvent;
    expect(parsed.id).toBe(event.id);
    expect(parsed.type).toBe(event.type);
  });

  // ── success path ────────────────────────────────────────────────────────

  it('log info khi delivery thành công (2xx)', async () => {
    const fetchMock = mockFetch(200);
    vi.stubGlobal('fetch', fetchMock);

    store.create('user1', 'https://example.com/hook', ['export.completed']);
    await dispatcher.dispatch(makeEvent('export.completed'), 'user1');
    await vi.runAllTimersAsync();

    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('delivered'));
  });

  // ── retry path ──────────────────────────────────────────────────────────

  it('retry khi server trả 500', async () => {
    // Lần đầu fail, lần 2 success
    let callCount = 0;
    const fetchMock = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) return Promise.resolve({ status: 500, ok: false });
      return Promise.resolve({ status: 200, ok: true });
    });
    vi.stubGlobal('fetch', fetchMock);

    store.create('user1', 'https://example.com/hook', ['export.completed']);
    await dispatcher.dispatch(makeEvent('export.completed'), 'user1');

    // Flush lần đầu (attempt 0 — fails)
    await flushMicrotasks();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Advance 1s (backoff[0]) để trigger retry attempt 1
    await vi.advanceTimersByTimeAsync(1000);
    await flushMicrotasks();
    expect(fetchMock).toHaveBeenCalledTimes(2);

    // Lần 2 success — log info delivered
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('delivered'));
  });

  it('retry khi có network error', async () => {
    let callCount = 0;
    const fetchMock = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) return Promise.reject(new Error('ECONNREFUSED'));
      return Promise.resolve({ status: 200, ok: true });
    });
    vi.stubGlobal('fetch', fetchMock);

    store.create('user1', 'https://example.com/hook', ['export.completed']);
    await dispatcher.dispatch(makeEvent('export.completed'), 'user1');

    await flushMicrotasks();
    await vi.advanceTimersByTimeAsync(1000);
    await flushMicrotasks();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('network_error'));
  });

  // ── final failure path ─────────────────────────────────────────────────

  it('log error final_failure sau 6 attempts (1 + 5 retries)', async () => {
    const fetchMock = mockFetch(503, false);
    vi.stubGlobal('fetch', fetchMock);

    store.create('user1', 'https://example.com/hook', ['export.completed']);
    await dispatcher.dispatch(makeEvent('export.completed'), 'user1');

    // Advance qua tất cả backoff windows: 1+2+4+8+16 = 31s
    await flushMicrotasks(); // attempt 0
    await vi.advanceTimersByTimeAsync(1000);
    await flushMicrotasks(); // attempt 1
    await vi.advanceTimersByTimeAsync(2000);
    await flushMicrotasks(); // attempt 2
    await vi.advanceTimersByTimeAsync(4000);
    await flushMicrotasks(); // attempt 3
    await vi.advanceTimersByTimeAsync(8000);
    await flushMicrotasks(); // attempt 4
    await vi.advanceTimersByTimeAsync(16000);
    await flushMicrotasks(); // attempt 5

    expect(fetchMock).toHaveBeenCalledTimes(6);
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('final_failure'));
  });

  it('không có pending timers sau khi tất cả đều thành công', async () => {
    const fetchMock = mockFetch(200);
    vi.stubGlobal('fetch', fetchMock);

    store.create('user1', 'https://example.com/hook', ['export.completed']);
    await dispatcher.dispatch(makeEvent('export.completed'), 'user1');
    await vi.runAllTimersAsync();

    expect(dispatcher.pendingCount()).toBe(0);
  });

  it('không có pending timers sau khi final failure', async () => {
    const fetchMock = mockFetch(500, false);
    vi.stubGlobal('fetch', fetchMock);

    store.create('user1', 'https://example.com/hook', ['export.completed']);
    await dispatcher.dispatch(makeEvent('export.completed'), 'user1');

    await flushMicrotasks();
    await vi.advanceTimersByTimeAsync(1000);
    await flushMicrotasks();
    await vi.advanceTimersByTimeAsync(2000);
    await flushMicrotasks();
    await vi.advanceTimersByTimeAsync(4000);
    await flushMicrotasks();
    await vi.advanceTimersByTimeAsync(8000);
    await flushMicrotasks();
    await vi.advanceTimersByTimeAsync(16000);
    await flushMicrotasks();

    expect(dispatcher.pendingCount()).toBe(0);
  });

  // ── SSRF guard ────────────────────────────────────────────────────────

  it('không dispatch tới URL private IP (SSRF re-validate)', async () => {
    const fetchMock = mockFetch(200);
    vi.stubGlobal('fetch', fetchMock);

    // Tạo subscription với URL hợp lệ, sau đó manually patch để test re-validate path
    // Cách đơn giản nhất: tạo store với stub findByUserId trả URL xấu
    const evilStore = {
      findByUserId: () => [
        {
          id: 'sub_evil',
          userId: 'user1',
          url: 'http://169.254.169.254/latest/meta-data',
          events: ['export.completed' as const],
          secret: 'a'.repeat(64),
          createdAt: new Date().toISOString(),
          active: true,
        },
      ],
    } as unknown as WebhookSubscriptionStore;

    const evilDispatcher = new WebhookDispatcher(evilStore, logger);
    await evilDispatcher.dispatch(makeEvent('export.completed'), 'user1');
    await vi.runAllTimersAsync();

    // Fetch không được gọi do SSRF block
    expect(fetchMock).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('SSRF'));
  });
});
