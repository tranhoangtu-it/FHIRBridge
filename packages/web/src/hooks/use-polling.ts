/**
 * Generic polling hook — repeatedly calls a fetch function at a set interval.
 * Stops automatically when shouldStop returns true or enabled becomes false.
 */

import { useState, useEffect, useRef, useCallback } from 'react';

export interface UsePollingOptions<T> {
  /** Interval in ms between polls. Default 2000. */
  interval?: number;
  /** Whether polling is active. */
  enabled: boolean;
  /** Return true to stop polling (e.g. status === 'complete'). */
  shouldStop?: (data: T) => boolean;
}

export interface UsePollingReturn<T> {
  data: T | null;
  error: string | null;
  polling: boolean;
  stop: () => void;
}

export function usePolling<T>(
  fetchFn: () => Promise<T>,
  options: UsePollingOptions<T>,
): UsePollingReturn<T> {
  const { interval = 2000, enabled, shouldStop } = options;
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [polling, setPolling] = useState(false);
  const stoppedRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stop = useCallback(() => {
    stoppedRef.current = true;
    setPolling(false);
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;

    stoppedRef.current = false;
    setPolling(true);

    const poll = async () => {
      if (stoppedRef.current) return;
      try {
        const result = await fetchFn();
        if (stoppedRef.current) return;
        setData(result);
        setError(null);
        if (shouldStop?.(result)) {
          setPolling(false);
          return;
        }
        timerRef.current = setTimeout(poll, interval);
      } catch (err) {
        if (stoppedRef.current) return;
        setError(err instanceof Error ? err.message : 'Polling error');
        setPolling(false);
      }
    };

    void poll();

    return () => {
      stoppedRef.current = true;
      if (timerRef.current) clearTimeout(timerRef.current);
      setPolling(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  return { data, error, polling, stop };
}
