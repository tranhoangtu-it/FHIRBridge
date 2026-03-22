/**
 * Tests for usePolling hook.
 * Uses real timers with short intervals to avoid fake-timer/async interaction issues.
 */

import { describe, it, expect, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { usePolling } from '../use-polling';

describe('usePolling', () => {
  it('starts polling and sets data at specified interval', async () => {
    const fetchFn = vi.fn().mockResolvedValue({ status: 'running' });

    const { result } = renderHook(() => usePolling(fetchFn, { enabled: true, interval: 50 }));

    await waitFor(() => {
      expect(fetchFn).toHaveBeenCalled();
      expect(result.current.data).toEqual({ status: 'running' });
    });
  });

  it('stops when shouldStop returns true', async () => {
    let callCount = 0;
    const fetchFn = vi.fn().mockImplementation(async () => {
      callCount++;
      return { status: callCount >= 2 ? 'complete' : 'running' };
    });

    const { result } = renderHook(() =>
      usePolling(fetchFn, {
        enabled: true,
        interval: 50,
        shouldStop: (data: { status: string }) => data.status === 'complete',
      }),
    );

    await waitFor(
      () => {
        expect(result.current.data?.status).toBe('complete');
        expect(result.current.polling).toBe(false);
      },
      { timeout: 2000 },
    );
  });

  it('does not start polling when enabled is false', async () => {
    const fetchFn = vi.fn().mockResolvedValue({ status: 'ok' });

    renderHook(() => usePolling(fetchFn, { enabled: false, interval: 50 }));

    // Wait a bit to confirm fetchFn is never called
    await new Promise((r) => setTimeout(r, 150));
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('handles errors gracefully and stops polling', async () => {
    const fetchFn = vi.fn().mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => usePolling(fetchFn, { enabled: true, interval: 50 }));

    await waitFor(
      () => {
        expect(result.current.error).toBe('Network error');
        expect(result.current.polling).toBe(false);
      },
      { timeout: 2000 },
    );
  });

  it('cleans up on unmount — no more calls after unmount', async () => {
    const fetchFn = vi.fn().mockResolvedValue({ status: 'running' });

    const { unmount } = renderHook(() => usePolling(fetchFn, { enabled: true, interval: 50 }));

    // Let at least one call happen
    await waitFor(() => expect(fetchFn).toHaveBeenCalled());

    unmount();
    const callsAtUnmount = fetchFn.mock.calls.length;

    // Wait and confirm no additional calls
    await new Promise((r) => setTimeout(r, 200));
    expect(fetchFn.mock.calls.length).toBe(callsAtUnmount);
  });

  it('manual stop() sets polling to false', async () => {
    const fetchFn = vi.fn().mockResolvedValue({ status: 'running' });

    const { result } = renderHook(() => usePolling(fetchFn, { enabled: true, interval: 50 }));

    // Wait for at least one poll
    await waitFor(() => expect(result.current.data).not.toBeNull());

    act(() => {
      result.current.stop();
    });

    expect(result.current.polling).toBe(false);
  });
});
