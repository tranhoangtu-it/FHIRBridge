/**
 * Tests for useApi hook.
 */

import { describe, it, expect, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useApi } from '../use-api';

describe('useApi', () => {
  it('starts with initial idle state', () => {
    const fn = vi.fn().mockResolvedValue('result');
    const { result } = renderHook(() => useApi(fn));

    expect(result.current.data).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('sets loading to true while request is in flight', async () => {
    let resolve!: (v: string) => void;
    const fn = vi.fn().mockImplementation(
      () =>
        new Promise<string>((r) => {
          resolve = r;
        }),
    );

    const { result } = renderHook(() => useApi(fn));

    act(() => {
      void result.current.execute();
    });

    expect(result.current.loading).toBe(true);
    resolve('done');
    await waitFor(() => expect(result.current.loading).toBe(false));
  });

  it('populates data on successful fetch', async () => {
    const fn = vi.fn().mockResolvedValue({ id: '1', name: 'Test' });
    const { result } = renderHook(() => useApi(fn));

    await act(async () => {
      await result.current.execute();
    });

    expect(result.current.data).toEqual({ id: '1', name: 'Test' });
    expect(result.current.error).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it('populates error on fetch failure', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('Server error'));
    const { result } = renderHook(() => useApi(fn));

    await act(async () => {
      await result.current.execute();
    });

    expect(result.current.data).toBeNull();
    expect(result.current.error).toBe('Server error');
    expect(result.current.loading).toBe(false);
  });

  it('handles non-Error rejections', async () => {
    const fn = vi.fn().mockRejectedValue('raw string error');
    const { result } = renderHook(() => useApi(fn));

    await act(async () => {
      await result.current.execute();
    });

    expect(result.current.error).toBe('Unknown error');
  });

  it('reset() clears state back to initial', async () => {
    const fn = vi.fn().mockResolvedValue({ id: '1' });
    const { result } = renderHook(() => useApi(fn));

    await act(async () => {
      await result.current.execute();
    });

    expect(result.current.data).not.toBeNull();

    act(() => {
      result.current.reset();
    });

    expect(result.current.data).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('passes arguments through to the underlying function', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    const { result } = renderHook(() => useApi(fn));

    await act(async () => {
      await result.current.execute('arg1', 'arg2');
    });

    expect(fn).toHaveBeenCalledWith('arg1', 'arg2');
  });
});
