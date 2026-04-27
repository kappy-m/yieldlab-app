import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "yl_current_property";
const SYNC_EVENT = "yl:property_change";

function readStored(defaultId: number): number {
  if (typeof window === "undefined") return defaultId;
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return defaultId;
  const id = parseInt(stored, 10);
  return !isNaN(id) && id > 0 ? id : defaultId;
}

/**
 * propertyId を全コンポーネント間で同期するフック。
 * - 同一ウィンドウ: CustomEvent で確実に伝播（StorageEvent はブラウザ依存で同タブ内の信頼性が低い）
 * - クロスタブ: native storage イベントで伝播
 */
export function useProperty(defaultId = 1): [number, (id: number) => void] {
  const [propertyId, setPropertyIdState] = useState<number>(() =>
    readStored(defaultId)
  );

  useEffect(() => {
    // マウント時に再確認（SSR hydration 後に localStorage が読める状態になるため）
    setPropertyIdState(readStored(defaultId));

    const handleCustom = (e: Event) => {
      const id = (e as CustomEvent<number>).detail;
      if (id > 0) setPropertyIdState(id);
    };

    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        const id = parseInt(e.newValue, 10);
        if (!isNaN(id) && id > 0) setPropertyIdState(id);
      }
    };

    window.addEventListener(SYNC_EVENT, handleCustom);
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener(SYNC_EVENT, handleCustom);
      window.removeEventListener("storage", handleStorage);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setPropertyId = useCallback((id: number) => {
    setPropertyIdState(id);
    localStorage.setItem(STORAGE_KEY, String(id));
    // CustomEvent: 同一ウィンドウ内の全 useProperty インスタンスに即時伝播
    window.dispatchEvent(new CustomEvent<number>(SYNC_EVENT, { detail: id }));
  }, []);

  return [propertyId, setPropertyId];
}
