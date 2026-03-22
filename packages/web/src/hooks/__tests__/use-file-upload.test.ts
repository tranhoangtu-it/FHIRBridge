/**
 * Tests for useFileUpload hook.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFileUpload } from '../use-file-upload';

// Minimal XHR mock
class MockXHR {
  status = 200;
  statusText = 'OK';
  responseText = '{}';
  upload = { addEventListener: vi.fn() };
  eventListeners: Record<string, (e?: unknown) => void> = {};

  open = vi.fn();
  setRequestHeader = vi.fn();
  send = vi.fn();

  addEventListener(event: string, cb: (e?: unknown) => void) {
    this.eventListeners[event] = cb;
  }

  trigger(event: string, arg?: unknown) {
    this.eventListeners[event]?.(arg);
  }
}

let mockXhr: MockXHR;

beforeEach(() => {
  mockXhr = new MockXHR();
  vi.stubGlobal(
    'XMLHttpRequest',
    vi.fn(() => mockXhr),
  );
  vi.clearAllMocks();
});

describe('useFileUpload — initial state', () => {
  it('starts with uploading false', () => {
    const { result } = renderHook(() => useFileUpload());
    expect(result.current.uploading).toBe(false);
  });

  it('starts with progress 0', () => {
    const { result } = renderHook(() => useFileUpload());
    expect(result.current.progress).toBe(0);
  });

  it('starts with error null', () => {
    const { result } = renderHook(() => useFileUpload());
    expect(result.current.error).toBeNull();
  });

  it('exposes upload function', () => {
    const { result } = renderHook(() => useFileUpload());
    expect(typeof result.current.upload).toBe('function');
  });

  it('exposes reset function', () => {
    const { result } = renderHook(() => useFileUpload());
    expect(typeof result.current.reset).toBe('function');
  });
});

describe('useFileUpload — upload', () => {
  it('sets uploading to true when upload starts', async () => {
    const { result } = renderHook(() => useFileUpload());
    const file = new File(['content'], 'test.csv', { type: 'text/csv' });

    let resolveUpload!: (v: unknown) => void;
    const uploadPromise = new Promise((r) => {
      resolveUpload = r;
    });

    act(() => {
      void result.current.upload('/upload', file).then(resolveUpload);
    });

    expect(result.current.uploading).toBe(true);
    // Resolve by triggering load
    act(() => {
      mockXhr.trigger('load');
    });
    await uploadPromise;
  });

  it('calls xhr.open with correct path including base URL', () => {
    const { result } = renderHook(() => useFileUpload());
    const file = new File(['content'], 'test.csv', { type: 'text/csv' });
    act(() => {
      void result.current.upload('/upload', file);
    });
    expect(mockXhr.open).toHaveBeenCalledWith('POST', expect.stringContaining('/upload'));
  });

  it('sets uploading false and returns parsed response on success', async () => {
    mockXhr.status = 200;
    mockXhr.responseText = '{"id":"upload-1"}';

    const { result } = renderHook(() => useFileUpload());
    const file = new File(['content'], 'test.csv', { type: 'text/csv' });

    let uploadResult: unknown;
    await act(async () => {
      const promise = result.current.upload('/upload', file);
      mockXhr.trigger('load');
      uploadResult = await promise;
    });

    expect(result.current.uploading).toBe(false);
    expect(result.current.progress).toBe(100);
    expect(uploadResult).toEqual({ id: 'upload-1' });
  });

  it('sets error state on non-2xx status', async () => {
    mockXhr.status = 500;
    mockXhr.statusText = 'Internal Server Error';

    const { result } = renderHook(() => useFileUpload());
    const file = new File(['content'], 'test.csv', { type: 'text/csv' });

    await act(async () => {
      const promise = result.current.upload('/upload', file);
      mockXhr.trigger('load');
      await promise;
    });

    expect(result.current.error).toContain('Upload failed');
    expect(result.current.uploading).toBe(false);
  });

  it('sets network error state on xhr error event', async () => {
    const { result } = renderHook(() => useFileUpload());
    const file = new File(['content'], 'test.csv', { type: 'text/csv' });

    await act(async () => {
      const promise = result.current.upload('/upload', file);
      mockXhr.trigger('error');
      await promise;
    });

    expect(result.current.error).toBe('Network error during upload');
  });
});

describe('useFileUpload — reset', () => {
  it('resets state to initial values', async () => {
    mockXhr.status = 500;
    mockXhr.statusText = 'Error';

    const { result } = renderHook(() => useFileUpload());
    const file = new File(['x'], 'f.csv');

    await act(async () => {
      const promise = result.current.upload('/upload', file);
      mockXhr.trigger('load');
      await promise;
    });

    expect(result.current.error).not.toBeNull();

    act(() => {
      result.current.reset();
    });

    expect(result.current.uploading).toBe(false);
    expect(result.current.progress).toBe(0);
    expect(result.current.error).toBeNull();
  });
});
