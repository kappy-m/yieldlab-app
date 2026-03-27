import { useState, useEffect } from "react";

/**
 * 入力値の変化を delay ms 遅延させて返す。
 * 検索フィールド等でAPIコール頻度を抑えるために使う。
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}
