import { startTransition, useEffect, useEffectEvent, useState } from "react";
import type {
  AutoSellSettings,
  DashboardResponse,
  OneClickBuyPrecheckResponse,
  OneClickBuyRequest,
  OneClickBuyResponse
} from "@trade/shared";
import { API_BASE_URL, DEMO_MODE, apiFetch } from "../api/client.js";
import {
  cancelDemoAutoSellTarget,
  cancelDemoBuyOrder,
  getDemoDashboard,
  getDemoTradingStatus,
  modifyDemoBuyOrder,
  precheckDemoOneClickBuy,
  refreshDemoTradingStatus,
  submitDemoOneClickBuy
} from "../demo/demo-api.js";

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
    orderQueue: [],
    recentEvents: [],
    profitLedger: {
      updatedAt: new Date(0).toISOString(),
      totalRealizedProfitUsd: 0,
      totalTradeCount: 0,
      exactTradeCount: 0,
      estimatedTradeCount: 0,
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

  const getDashboard = async () =>
    DEMO_MODE ? getDemoDashboard() : apiFetch<DashboardResponse>("/api/dashboard");
  const getTradingStatus = async () =>
    DEMO_MODE ? getDemoTradingStatus() : apiFetch<DashboardResponse["trading"]>("/api/trading/status");

  const loadDashboard = useEffectEvent(async (mode: "manual" | "background" = "background") => {
    if (mode === "manual") {
      setRefreshing(true);
    } else {
      setBackgroundRefreshing(true);
    }

    try {
      const nextData = await getDashboard();
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
      const trading = await getTradingStatus();
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
    if (DEMO_MODE) {
      setError("데모 모드에서는 자동매도 설정 저장을 잠가두었습니다.");
      return;
    }

    const trading = await apiFetch<DashboardResponse["trading"]>("/api/trading/settings", {
      method: "POST",
      body: JSON.stringify(settings)
    });

    setData((current) => (current ? { ...current, trading } : current));
  };

  const submitOneClickBuy = async (order: OneClickBuyRequest) => {
    const result = DEMO_MODE
      ? await submitDemoOneClickBuy(order)
      : await apiFetch<OneClickBuyResponse>("/api/trading/one-click-buy", {
          method: "POST",
          body: JSON.stringify(order)
        });

    await loadDashboard("background");
    return result;
  };

  const precheckOneClickBuy = async (order: OneClickBuyRequest) =>
    DEMO_MODE
      ? precheckDemoOneClickBuy(order)
      : apiFetch<OneClickBuyPrecheckResponse>("/api/trading/one-click-buy/precheck", {
          method: "POST",
          body: JSON.stringify(order)
        });

  const refresh = async () => {
    if (DEMO_MODE) {
      const trading = await refreshDemoTradingStatus();
      startTransition(() => {
        setData((current) => ({ ...current, trading }));
      });
      setError(null);
      return;
    }

    await apiFetch("/api/trading/refresh", {
      method: "POST"
    });
    await loadDashboard("manual");
  };

  const cancelAutoSellTarget = async (targetId: string) => {
    try {
      const trading = DEMO_MODE
        ? await cancelDemoAutoSellTarget(targetId)
        : await apiFetch<DashboardResponse["trading"]>(`/api/trading/targets/${targetId}/cancel`, {
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
      const trading = DEMO_MODE
        ? await modifyDemoBuyOrder(targetId, limitPrice)
        : await apiFetch<DashboardResponse["trading"]>(
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
      const trading = DEMO_MODE
        ? await cancelDemoBuyOrder(targetId)
        : await apiFetch<DashboardResponse["trading"]>(
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
    cancelBuyOrder,
    demoMode: DEMO_MODE,
    apiBaseUrl: API_BASE_URL
  };
}
