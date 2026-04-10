import { startTransition, useDeferredValue, useEffect, useRef, useState } from "react";
import type { SymbolSearchResult } from "@trade/shared";
import { apiFetch } from "../api/client.js";

export function useSymbolSearch(query: string) {
  const deferredQuery = useDeferredValue(query.trim());
  const cacheRef = useRef(new Map<string, SymbolSearchResult[]>());
  const [results, setResults] = useState<SymbolSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (deferredQuery.length < 2) {
      setResults([]);
      setError(null);
      setLoading(false);
      return;
    }

    const cached = cacheRef.current.get(deferredQuery);

    if (cached) {
      startTransition(() => {
        setResults(cached);
      });
      setError(null);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);

      try {
        const nextResults = await apiFetch<SymbolSearchResult[]>(
          `/api/market/symbol-search?q=${encodeURIComponent(deferredQuery)}`,
          {
            signal: controller.signal
          }
        );

        cacheRef.current.set(deferredQuery, nextResults);
        startTransition(() => {
          setResults(nextResults);
        });
        setError(null);
      } catch (searchError) {
        if (controller.signal.aborted) {
          return;
        }

        startTransition(() => {
          setResults([]);
        });
        setError(searchError instanceof Error ? searchError.message : "종목 검색 실패");
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }, 250);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [deferredQuery]);

  return {
    results,
    loading,
    error
  };
}
