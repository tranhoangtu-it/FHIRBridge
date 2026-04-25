/**
 * Tests cho WebhookSubscriptionStore.
 * Coverage: CRUD, owner isolation, secret generation.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { WebhookSubscriptionStore } from '../webhook-subscription-store.js';

describe('WebhookSubscriptionStore', () => {
  let store: WebhookSubscriptionStore;

  beforeEach(() => {
    store = new WebhookSubscriptionStore();
  });

  // ── create ─────────────────────────────────────────────────────────────────

  it('tạo subscription với ID dạng sub_<uuid>', () => {
    const result = store.create('user1', 'https://example.com/hook', ['export.completed']);
    expect(result.id).toMatch(/^sub_[0-9a-f-]{36}$/);
  });

  it('trả về secret 64-char hex (32 bytes)', () => {
    const result = store.create('user1', 'https://example.com/hook', ['export.completed']);
    expect(result.secret).toMatch(/^[0-9a-f]{64}$/);
  });

  it('mỗi subscription có secret khác nhau', () => {
    const r1 = store.create('user1', 'https://a.com/hook', ['export.completed']);
    const r2 = store.create('user1', 'https://b.com/hook', ['export.completed']);
    expect(r1.secret).not.toBe(r2.secret);
  });

  it('lưu đúng url và events', () => {
    const url = 'https://example.com/hook';
    const events = ['export.completed', 'export.failed'] as const;
    const result = store.create('user1', url, [...events]);
    expect(result.url).toBe(url);
    expect(result.events).toEqual(expect.arrayContaining([...events]));
  });

  it('createdAt là ISO string hợp lệ', () => {
    const result = store.create('user1', 'https://example.com/hook', ['export.completed']);
    expect(() => new Date(result.createdAt)).not.toThrow();
    expect(new Date(result.createdAt).toISOString()).toBe(result.createdAt);
  });

  // ── findById ───────────────────────────────────────────────────────────────

  it('findById trả subscription đã tạo', () => {
    const result = store.create('user1', 'https://example.com/hook', ['export.completed']);
    const found = store.findById(result.id);
    expect(found).toBeDefined();
    expect(found!.id).toBe(result.id);
    expect(found!.active).toBe(true);
  });

  it('findById trả undefined khi không tồn tại', () => {
    expect(store.findById('sub_nonexistent')).toBeUndefined();
  });

  // ── findByUserId ───────────────────────────────────────────────────────────

  it('findByUserId trả đúng subscriptions của user', () => {
    store.create('user1', 'https://a.com/hook', ['export.completed']);
    store.create('user1', 'https://b.com/hook', ['export.failed']);
    store.create('user2', 'https://c.com/hook', ['summary.completed']);

    const user1Subs = store.findByUserId('user1');
    expect(user1Subs).toHaveLength(2);
    expect(user1Subs.every((s) => s.userId === 'user1')).toBe(true);
  });

  it('owner isolation: user2 không thấy subscription của user1', () => {
    store.create('user1', 'https://secret.com/hook', ['export.completed']);
    const user2Subs = store.findByUserId('user2');
    expect(user2Subs).toHaveLength(0);
  });

  it('findByUserId trả [] khi user không có subscription nào', () => {
    expect(store.findByUserId('nobody')).toEqual([]);
  });

  // ── delete ─────────────────────────────────────────────────────────────────

  it('delete thành công trả true và xóa khỏi store', () => {
    const result = store.create('user1', 'https://example.com/hook', ['export.completed']);
    expect(store.delete(result.id, 'user1')).toBe(true);
    expect(store.findById(result.id)).toBeUndefined();
    expect(store.size()).toBe(0);
  });

  it('delete không tìm thấy trả false', () => {
    expect(store.delete('sub_nonexistent', 'user1')).toBe(false);
  });

  it('delete với userId sai trả false (IDOR protection)', () => {
    const result = store.create('user1', 'https://example.com/hook', ['export.completed']);
    // user2 không được xóa subscription của user1
    expect(store.delete(result.id, 'user2')).toBe(false);
    // Subscription vẫn còn
    expect(store.findById(result.id)).toBeDefined();
  });

  it('sau delete, findByUserId không trả subscription đã xóa', () => {
    const r1 = store.create('user1', 'https://a.com/hook', ['export.completed']);
    store.create('user1', 'https://b.com/hook', ['export.failed']);

    store.delete(r1.id, 'user1');

    const remaining = store.findByUserId('user1');
    expect(remaining).toHaveLength(1);
    expect(remaining[0]!.url).toBe('https://b.com/hook');
  });

  // ── size ───────────────────────────────────────────────────────────────────

  it('size() theo dõi đúng số lượng', () => {
    expect(store.size()).toBe(0);
    store.create('user1', 'https://a.com/hook', ['export.completed']);
    expect(store.size()).toBe(1);
    store.create('user2', 'https://b.com/hook', ['export.failed']);
    expect(store.size()).toBe(2);
  });
});
