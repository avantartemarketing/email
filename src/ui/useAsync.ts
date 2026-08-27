import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Small data-fetching hook: runs `fn` when `deps` change, exposes a `reload`
 * for after mutations. Reloads keep showing stale data (no flicker); the
 * initial load reports `loading`.
 */
export function useAsync<T>(
  fn: () => Promise<T>,
  deps: unknown[],
): {
  data: T | null;
  loading: boolean;
  error: Error | null;
  reload: () => void;
} {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [tick, setTick] = useState(0);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  useEffect(() => {
    let alive = true;
    setError(null);
    fnRef
      .current()
      .then((result) => {
        if (!alive) return;
        setData(result);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (!alive) return;
        setError(err instanceof Error ? err : new Error(String(err)));
        setLoading(false);
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { data, loading, error, reload };
}
