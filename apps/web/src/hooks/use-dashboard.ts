import { startTransition, useEffect, useEffectEvent, useState } from "react";
import type {
  AutoSellSettings,
  DashboardResponse,
  OneClickBuyPrecheckResponse,
  OneClickBuyRequest,
  OneClickBuyResponse
} from "@trade/shared";
import { apiFetch } from "../api/client.js";

const emptyDashboard: DashboardResponse = {
  trading: {
    settings: {
      enabled: true,
      targetProfitPercent: 5,
      pollIntervalMs: 5_000,
      watchSymbols: []
    },
    monitorRunning: false,
    holdings: [],
    accountSummary: {
      heldSymbolCount: 0,
      totalHoldingQuantity: 0,
      orderableCashUsd: 0,
      currency: "USD"
    },
    autoSellTargets: [],
    recentEvents: [],
    profitLedger: {
      updatedAt: new Date(0).toISOString(),
      totalRealizedProfitUsd: 0,
      totalTradeCount: 0,
      ranges: [
        { code: "1d", label: "1일", realizedProfitUsd: 0, tradeCount: 0, chart: [] },
        { code: "7d", label: "7일", realizedProfitUsd: 0, tradeCount: 0, chart: [] },
        { code: "14d", label: "14일", realizedProfitUsd: 0, tradeCount: 0, chart: [] },
        { code: "30d", label: "30일", realizedProfitUsd: 0, tradeCount: 0, chart: [] },
        { code: "6m", label: "6개월", realizedProfitUsd: 0, tradeCount: 0, chart: [] },
        { code: "1y", label: "1년", realizedProfitUsd: 0, tradeCount: 0, chart: [] }
      ],
      recentEntries: []
    }
  },
  market: {
    generatedAt: new Date(0).toISOString(),
    analysisGeneratedAt: new Date(0).toISOString(),
    usdKrwRate: 0,
    usdKrwUpdatedAt: undefined,
    blueChips: [],
    trendingThemes: [],
    sectorLeaders: [],
    industryMomentumLeaders: [],
    analysis: [],
    analysisHistory: []
  },
  llm: {
    provider: "codex-cli",
    model: "gpt-5.2-codex",
    loginStatus: "확인 중"
  }
};

export function useDashboard() {
  const [data, setData] = useState<DashboardResponse>(emptyDashboard);
  const [refreshing, setRefreshing] = useState(false);
  const [backgroundRefreshing, setBackgroundRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = useEffectEvent(async (mode: "manual" | "background" = "background") => {
    if (mode === "manual") {
      setRefreshing(true);
    } else {
      setBackgroundRefreshing(true);
    }

    try {
      const nextData = await apiFetch<DashboardResponse>("/api/dashboard");
      if (mode === "manual") {
        setError(null);
      }
      startTransition(() => {
        setData(nextData);
      });
    } catch (loadError) {
      if (mode === "manual") {
        setError(loadError instanceof Error ? loadError.message : "대시보드 로딩 실패");
      }
    } finally {
      if (mode === "manual") {
        setRefreshing(false);
      } else {
        setBackgroundRefreshing(false);
      }
    }
  });

  useEffect(() => {
    void loadDashboard();

    const timer = window.setInterval(() => {
      void loadDashboard();
    }, 30_000);

    return () => window.clearInterval(timer);
  }, [loadDashboard]);

  const loadTradingStatus = useEffectEvent(async () => {
    try {
      const trading = await apiFetch<DashboardResponse["trading"]>("/api/trading/status");
      startTransition(() => {
        setData((current) => ({ ...current, trading }));
      });
    } catch {
      // Keep the last known status if lightweight polling fails temporarily.
    }
  });

  useEffect(() => {
    const pollMs = Math.max(5_000, data.trading.settings.pollIntervalMs || 5_000);
    const timer = window.setInterval(() => {
      void loadTradingStatus();
    }, pollMs);

    return () => window.clearInterval(timer);
  }, [data.trading.settings.pollIntervalMs, loadTradingStatus]);

  const updateSettings = async (settings: Partial<AutoSellSettings>) => {
    const trading = await apiFetch<DashboardResponse["trading"]>("/api/trading/settings", {
      method: "POST",
      body: JSON.stringify(settings)
    });

    setData((current) => (current ? { ...current, trading } : current));
  };

  const submitOneClickBuy = async (order: OneClickBuyRequest) => {
    const result = await apiFetch<OneClickBuyResponse>("/api/trading/one-click-buy", {
      method: "POST",
      body: JSON.stringify(order)
    });

    await loadDashboard("background");
    return result;
  };

  const precheckOneClickBuy = async (order: OneClickBuyRequest) =>
    apiFetch<OneClickBuyPrecheckResponse>("/api/trading/one-click-buy/precheck", {
      method: "POST",
      body: JSON.stringify(order)
    });

  const refresh = async () => {
    await apiFetch("/api/trading/refresh", {
      method: "POST"
    });
    await loadDashboard("manual");
  };

  const cancelAutoSellTarget = async (targetId: string) => {
    try {
      const trading = await apiFetch<DashboardResponse["trading"]>(`/api/trading/targets/${targetId}/cancel`, {
        method: "POST"
      });

      setError(null);
      setData((current) => (current ? { ...current, trading } : current));
    } catch (cancelError) {
      setError(cancelError instanceof Error ? cancelError.message : "자동매도 취소 실패");
      throw cancelError;
    }
  };

  const modifyBuyOrder = async (targetId: string, limitPrice: number) => {
    try {
      const trading = await apiFetch<DashboardResponse["trading"]>(
        `/api/trading/targets/${targetId}/buy-order/modify`,
        {
          method: "POST",
          body: JSON.stringify({ limitPrice })
        }
      );

      setError(null);
      setData((current) => (current ? { ...current, trading } : current));
    } catch (modifyError) {
      setError(modifyError instanceof Error ? modifyError.message : "매수 주문 수정 실패");
      throw modifyError;
    }
  };

  const cancelBuyOrder = async (targetId: string) => {
    try {
      const trading = await apiFetch<DashboardResponse["trading"]>(
        `/api/trading/targets/${targetId}/buy-order/cancel`,
        {
          method: "POST"
        }
      );

      setError(null);
      setData((current) => (current ? { ...current, trading } : current));
    } catch (cancelError) {
      setError(cancelError instanceof Error ? cancelError.message : "매수 주문 취소 실패");
      throw cancelError;
    }
  };

  return {
    data,
    refreshing,
    backgroundRefreshing,
    error,
    updateSettings,
    refresh,
    precheckOneClickBuy,
    submitOneClickBuy,
    cancelAutoSellTarget,
    modifyBuyOrder,
    cancelBuyOrder
  };
}
