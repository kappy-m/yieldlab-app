import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "yl_current_property";

/**
 * localStorage でプロパティIDを共有するフック。
 * ProductSidebar（ホテル切り替え）と各プロダクトページが同一の値を読み書きし、
 * StorageEvent でページ間・コンポーネント間の同期を行う。
 */
export function useProperty(defaultId = 1): [number, (id: number) => void] {
  const [propertyId, setPropertyIdState] = useState<number>(defaultId);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const id = parseInt(stored, 10);
      if (!isNaN(id) && id > 0) setPropertyIdState(id);
    }

    const handler = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        const id = parseInt(e.newValue, 10);
        if (!isNaN(id) && id > 0) setPropertyIdState(id);
      }
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  const setPropertyId = useCallback((id: number) => {
    setPropertyIdState(id);
    localStorage.setItem(STORAGE_KEY, String(id));
    // 同一ウィンドウ内の他コンポーネントにも変更を伝播させる
    window.dispatchEvent(
      new StorageEvent("storage", { key: STORAGE_KEY, newValue: String(id) })
    );
  }, []);

  return [propertyId, setPropertyId];
}
