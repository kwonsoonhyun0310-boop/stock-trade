import { startTransition, useEffect, useEffectEvent, useState } from "react";
import type {
  AutoSellSettings,
  DashboardResponse,
  ManualOrderRequest,
  ManualOrderResponse
} from "@trade/shared";
import { apiFetch } from "../api/client.js";

const emptyDashboard: DashboardResponse = {
  trading: {
    settings: {
      enabled: false,
      targetProfitPercent: 5,
      pollIntervalMs: 45_000,
      watchSymbols: []
    },
    monitorRunning: false,
    holdings: [],
    recentEvents: []
  },
  market: {
    generatedAt: new Date(0).toISOString(),
    blueChips: [],
    trendingThemes: [],
    sectorLeaders: [],
    analysis: []
  },
  llm: {
    provider: "codex-cli",
    model: "gpt-5.2-codex",
    loginStatus: "확인 중"
  }
};

export function useDashboard() {
  const [data, setData] = useState<DashboardResponse>(emptyDashboard);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = useEffectEvent(async () => {
    setRefreshing(true);

    try {
      const nextData = await apiFetch<DashboardResponse>("/api/dashboard");
      setError(null);
      startTransition(() => {
        setData(nextData);
      });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "대시보드 로딩 실패");
    } finally {
      setRefreshing(false);
    }
  });

  useEffect(() => {
    void loadDashboard();

    const timer = window.setInterval(() => {
      void loadDashboard();
    }, 30_000);

    return () => window.clearInterval(timer);
  }, [loadDashboard]);

  const updateSettings = async (settings: Partial<AutoSellSettings>) => {
    const trading = await apiFetch<DashboardResponse["trading"]>("/api/trading/settings", {
      method: "POST",
      body: JSON.stringify(settings)
    });

    setData((current) => (current ? { ...current, trading } : current));
  };

  const submitOrder = async (order: ManualOrderRequest) => {
    const result = await apiFetch<ManualOrderResponse>("/api/trading/order", {
      method: "POST",
      body: JSON.stringify(order)
    });

    await loadDashboard();
    return result;
  };

  const refresh = async () => {
    await apiFetch("/api/trading/refresh", {
      method: "POST"
    });
    await loadDashboard();
  };

  return {
    data,
    loading,
    refreshing,
    error,
    updateSettings,
    refresh,
    submitOrder
  };
}
