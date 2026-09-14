import { useCallback, useEffect, useState } from 'react';

import { adminJson } from './api';

// Small data hook: fetches from the admin API, with loading / error / refresh.
export function useAdminData<T>(path: string) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      setError(null);
      try {
        const result = await adminJson<T>(path);
        setData(result);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Something went wrong.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [path]
  );

  useEffect(() => {
    load();
  }, [load]);

  return { data, loading, refreshing, error, refresh: () => load(true) };
}
