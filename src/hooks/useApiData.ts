/**
 * useApiData - データフェッチの共通フック（SWR キャッシュ対応）
 *
 * 各コンポーネントで繰り返されていた loading / error / data の
 * useState パターンを一元化する。
 *
 * SWR: タブ切替時にキャッシュから即座に表示し、バックグラウンドで再検証する。
 * ALWAYS_MOUNTED 廃止後もタブ切替が高速に感じられる仕組み。
 *
 * 使い方:
 *   const { data, loading, error, reload } = useApiData(
 *     () => fetchSomething(propertyId),
 *     [propertyId]          // 依存配列（省略可）
 *   );
 */

import { useState, useEffect, useCallback, useRef } from "react";

// グローバルキャッシュ: fetcher の依存配列をキーにしてデータを保持
const cache = new Map<string, { data: unknown; timestamp: number }>();
const STALE_TIME = 30_000; // 30秒以内ならキャッシュ優先

interface UseApiDataResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

export function useApiData<T>(
  fetcher: () => Promise<T>,
  deps: React.DependencyList = []
): UseApiDataResult<T> {
  // deps を文字列化してキャッシュキーにする
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const cacheKey = JSON.stringify(deps);

  const cached = cache.get(cacheKey);
  const hasFreshCache = cached && Date.now() - cached.timestamp < STALE_TIME;

  const [data, setData] = useState<T | null>(
    hasFreshCache ? (cached.data as T) : null
  );
  const [loading, setLoading] = useState(!hasFreshCache);
  const [error, setError] = useState<string | null>(null);

  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const load = useCallback(async () => {
    // キャッシュが新鮮ならスキップ
    const existingCache = cache.get(cacheKey);
    const isFresh = existingCache && Date.now() - existingCache.timestamp < STALE_TIME;

    if (!isFresh) {
      setLoading(true);
    }
    setError(null);

    try {
      const result = await fetcherRef.current();
      setData(result);
      cache.set(cacheKey, { data: result, timestamp: Date.now() });
    } catch (e) {
      setError(e instanceof Error ? e.message : "データの取得に失敗しました");
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey]);

  useEffect(() => {
    load();
  }, [load]);

  return { data, loading, error, reload: load };
}
