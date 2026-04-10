import { useEffect, useState } from "react";

export type FontScaleOption = "default" | "large" | "xlarge";

const STORAGE_KEY = "trade-dashboard-font-scale";

const isFontScaleOption = (value: string): value is FontScaleOption =>
  value === "default" || value === "large" || value === "xlarge";

const readStoredFontScale = (): FontScaleOption => {
  if (typeof window === "undefined") {
    return "default";
  }

  const storedValue = window.localStorage.getItem(STORAGE_KEY);
  return storedValue && isFontScaleOption(storedValue) ? storedValue : "default";
};

export function useFontScale() {
  const [fontScale, setFontScale] = useState<FontScaleOption>(() => readStoredFontScale());

  useEffect(() => {
    document.documentElement.dataset.fontScale = fontScale;
    window.localStorage.setItem(STORAGE_KEY, fontScale);
  }, [fontScale]);

  return {
    fontScale,
    setFontScale
  };
}
