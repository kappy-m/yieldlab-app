/**
 * useApiData - データフェッチの共通フック
 *
 * 各コンポーネントで繰り返されていた loading / error / data の
 * useState パターンを一元化する。
 *
 * 使い方:
 *   const { data, loading, error, reload } = useApiData(
 *     () => fetchSomething(propertyId),
 *     [propertyId]          // 依存配列（省略可）
 *   );
 */

import { useState, useEffect, useCallback, useRef } from "react";

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
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // fetcher を ref に持つことで依存配列に含めず、かつ最新値を参照できる
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetcherRef.current();
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "データの取得に失敗しました");
    } finally {
      setLoading(false);
    }
  // deps は呼び出し元から渡されたもののみ（fetcherRef は安定している）
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    load();
  }, [load]);

  return { data, loading, error, reload: load };
}
