/**
 * Tests for useBaaAcknowledgment hook.
 *
 * Covers:
 * - Initial state từ clean localStorage
 * - requestAcknowledgment() resolve true khi đã ack trước đó
 * - onConfirm() ghi localStorage và resolve true
 * - onCancel() resolve false và không ghi ack
 * - Version mismatch buộc re-acknowledge
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useBaaAcknowledgment } from '../use-baa-acknowledgment';

const STORAGE_KEY = 'fhirbridge.baa.acknowledged.v1';

function setStoredAck(acknowledged: boolean, version = 'v1') {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ version, acknowledged, timestamp: Date.now() }),
  );
}

describe('useBaaAcknowledgment', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('acknowledged = false khi localStorage rỗng', () => {
    const { result } = renderHook(() => useBaaAcknowledgment());
    expect(result.current.acknowledged).toBe(false);
  });

  it('acknowledged = true khi localStorage có ack hợp lệ', () => {
    setStoredAck(true);
    const { result } = renderHook(() => useBaaAcknowledgment());
    expect(result.current.acknowledged).toBe(true);
  });

  it('acknowledged = false khi version lệch (buộc re-ack)', () => {
    setStoredAck(true, 'v0'); // version cũ
    const { result } = renderHook(() => useBaaAcknowledgment());
    expect(result.current.acknowledged).toBe(false);
  });

  it('isModalOpen = false lúc khởi tạo', () => {
    const { result } = renderHook(() => useBaaAcknowledgment());
    expect(result.current.isModalOpen).toBe(false);
  });

  it('requestAcknowledgment() resolve true ngay nếu đã ack', async () => {
    setStoredAck(true);
    const { result } = renderHook(() => useBaaAcknowledgment());

    let resolved: boolean | undefined;
    await act(async () => {
      resolved = await result.current.requestAcknowledgment();
    });

    expect(resolved).toBe(true);
    expect(result.current.isModalOpen).toBe(false);
  });

  it('requestAcknowledgment() mở modal khi chưa ack', async () => {
    const { result } = renderHook(() => useBaaAcknowledgment());

    act(() => {
      void result.current.requestAcknowledgment();
    });

    expect(result.current.isModalOpen).toBe(true);
  });

  it('onConfirm() resolve true, đóng modal, ghi localStorage, cập nhật acknowledged', async () => {
    const { result } = renderHook(() => useBaaAcknowledgment());

    let resolved: boolean | undefined;
    act(() => {
      result.current.requestAcknowledgment().then((v) => {
        resolved = v;
      });
    });

    expect(result.current.isModalOpen).toBe(true);

    await act(async () => {
      result.current.onConfirm();
    });

    expect(resolved).toBe(true);
    expect(result.current.isModalOpen).toBe(false);
    expect(result.current.acknowledged).toBe(true);

    // Kiểm tra localStorage được ghi
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as {
      version: string;
      acknowledged: boolean;
    };
    expect(stored.version).toBe('v1');
    expect(stored.acknowledged).toBe(true);
  });

  it('onCancel() resolve false, đóng modal, không ghi ack', async () => {
    const { result } = renderHook(() => useBaaAcknowledgment());

    let resolved: boolean | undefined;
    act(() => {
      result.current.requestAcknowledgment().then((v) => {
        resolved = v;
      });
    });

    await act(async () => {
      result.current.onCancel();
    });

    expect(resolved).toBe(false);
    expect(result.current.isModalOpen).toBe(false);
    expect(result.current.acknowledged).toBe(false);
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('requestAcknowledgment() có thể gọi nhiều lần tuần tự', async () => {
    const { result } = renderHook(() => useBaaAcknowledgment());

    // Lần 1: cancel
    let r1: boolean | undefined;
    act(() => {
      result.current.requestAcknowledgment().then((v) => {
        r1 = v;
      });
    });
    await act(async () => {
      result.current.onCancel();
    });
    expect(r1).toBe(false);

    // Lần 2: confirm
    let r2: boolean | undefined;
    act(() => {
      result.current.requestAcknowledgment().then((v) => {
        r2 = v;
      });
    });
    await act(async () => {
      result.current.onConfirm();
    });
    expect(r2).toBe(true);
    expect(result.current.acknowledged).toBe(true);
  });

  it('xử lý localStorage corrupt — treated as chưa ack', () => {
    localStorage.setItem(STORAGE_KEY, 'not-valid-json{{{');
    const { result } = renderHook(() => useBaaAcknowledgment());
    expect(result.current.acknowledged).toBe(false);
  });
});
