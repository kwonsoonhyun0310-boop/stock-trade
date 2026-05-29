import { startTransition, useEffect, useEffectEvent, useState } from "react";
import type { WatchlistMonitorSnapshot, WatchlistSymbolInput } from "@trade/shared";
import { DEMO_MODE, apiFetch } from "../api/client.js";
import { getDemoWatchlistQuotes } from "../demo/demo-api.js";

const WATCHLIST_REFRESH_INTERVAL_MS = 60_000;

const emptySnapshot: WatchlistMonitorSnapshot = {
  updatedAt: new Date(0).toISOString(),
  items: []
};

interface UseWatchlistMonitorOptions {
  favorites: WatchlistSymbolInput[];
}

export function useWatchlistMonitor({ favorites }: UseWatchlistMonitorOptions) {
  const [snapshot, setSnapshot] = useState<WatchlistMonitorSnapshot>(emptySnapshot);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const favoritesSignature = favorites
    .map((favorite) => `${favorite.exchange}:${favorite.symbol}:${favorite.name}`)
    .join("|");

  const loadSnapshot = useEffectEvent(async (mode: "initial" | "manual" | "background") => {
    if (favorites.length === 0) {
      startTransition(() => {
        setSnapshot(emptySnapshot);
        setError(null);
      });
      setLoading(false);
      setRefreshing(false);
      return;
    }

    if (mode === "manual") {
      setRefreshing(true);
    } else if (mode === "initial") {
      setLoading(true);
    }

    try {
      const nextSnapshot = DEMO_MODE
        ? await getDemoWatchlistQuotes(favorites)
        : await apiFetch<WatchlistMonitorSnapshot>("/api/market/watchlist/quotes", {
            method: "POST",
            body: JSON.stringify({
              favorites
            })
          });

      startTransition(() => {
        setSnapshot(nextSnapshot);
        setError(null);
      });
    } catch (nextError) {
      if (mode !== "background" || snapshot.items.length === 0) {
        setError(nextError instanceof Error ? nextError.message : "관심종목 감시에 실패했습니다.");
      }
    } finally {
      if (mode === "manual") {
        setRefreshing(false);
      } else if (mode === "initial") {
        setLoading(false);
      }
    }
  });

  useEffect(() => {
    void loadSnapshot("initial");

    if (favorites.length === 0) {
      return;
    }

    const timer = window.setInterval(() => {
      void loadSnapshot("background");
    }, WATCHLIST_REFRESH_INTERVAL_MS);

    return () => {
      window.clearInterval(timer);
    };
  }, [favorites.length, favoritesSignature, loadSnapshot]);

  return {
    snapshot,
    loading,
    refreshing,
    error,
    refresh: async () => {
      await loadSnapshot("manual");
    }
  };
}
