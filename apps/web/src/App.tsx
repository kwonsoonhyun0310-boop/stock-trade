import { useEffect, useRef, useState } from "react";
import type { AutoSellEvent } from "@trade/shared";
import { AccountWorkspace } from "./components/account-workspace.js";
import { DashboardTabs, type DashboardTabItem, type DashboardTabKey } from "./components/dashboard-tabs.js";
import { MarketWorkspace } from "./components/market-workspace.js";
import { ToastStack } from "./components/toast-stack.js";
import { TradingWorkspace } from "./components/trading-workspace.js";
import { useDesktopNotifications } from "./hooks/use-desktop-notifications.js";
import { useDashboard } from "./hooks/use-dashboard.js";
import { useFavoriteSymbols } from "./hooks/use-favorite-symbols.js";
import { useToastCenter } from "./hooks/use-toast-center.js";

const usdCurrency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2
});

const getToastTitle = (event: AutoSellEvent) => {
  if (event.status === "failed") {
    return `${event.symbol} 주문 실패`;
  }

  if (event.status === "cancelled") {
    if (event.reason.includes("원클릭 매수 주문")) {
      return `${event.symbol} 매수 주문 취소`;
    }

    return `${event.symbol} 자동매도 추적 취소`;
  }

  if (event.status === "completed") {
    if (event.reason.includes("자동매도")) {
      return `${event.symbol} 자동매도 체결 완료`;
    }

    return `${event.symbol} 매수 체결 완료`;
  }

  if (event.reason.includes("자동매도")) {
    return `${event.symbol} 자동매도 주문 접수`;
  }

  return `${event.symbol} 매수 주문 접수`;
};

const getToastTone = (event: AutoSellEvent) => {
  switch (event.status) {
    case "failed":
      return "error" as const;
    case "completed":
    case "submitted":
      return "success" as const;
    default:
      return "neutral" as const;
  }
};

const DASHBOARD_TABS: DashboardTabItem[] = [
  {
    key: "trade",
    label: "투자 실행",
    description: "매수, 즐겨찾기, 자동매도와 주문 상태를 관리합니다."
  },
  {
    key: "account",
    label: "내 계좌",
    description: "보유 종목, 실현 손익 장부, 이벤트 기록을 확인합니다."
  },
  {
    key: "market",
    label: "시장 정보",
    description: "코덱스 분석과 우량주·분야 흐름을 한 화면에서 봅니다."
  }
];

export default function App() {
  const [buyPresetSelection, setBuyPresetSelection] = useState<{
    symbol: string;
    requestId: number;
  } | null>(null);
  const [activeTab, setActiveTab] = useState<DashboardTabKey>("trade");
  const seenEventIdsRef = useRef(new Set<string>());
  const { toasts, pushToast, dismissToast } = useToastCenter();
  const {
    permission: desktopNotificationPermission,
    supported: desktopNotificationSupported,
    requestPermission: requestDesktopNotificationPermission,
    notify
  } = useDesktopNotifications();
  const { favorites, addFavorite, removeFavorite, isFavorite } = useFavoriteSymbols();
  const {
    data,
    error,
    refreshing,
    refresh,
    precheckOneClickBuy,
    submitOneClickBuy,
    cancelAutoSellTarget,
    modifyBuyOrder,
    cancelBuyOrder
  } = useDashboard();

  useEffect(() => {
    if (data.trading.recentEvents.length === 0) {
      return;
    }

    if (seenEventIdsRef.current.size === 0) {
      for (const event of data.trading.recentEvents) {
        seenEventIdsRef.current.add(event.id);
      }
      return;
    }

    const nextEvents = [...data.trading.recentEvents]
      .filter((event) => !seenEventIdsRef.current.has(event.id))
      .reverse();

    for (const event of nextEvents) {
      seenEventIdsRef.current.add(event.id);
      pushToast({
        title: getToastTitle(event),
        message: event.reason,
        tone: getToastTone(event)
      });
      notify({
        title: getToastTitle(event),
        body: event.reason,
        tag: event.orderNumber || event.id
      });
    }
  }, [data.trading.recentEvents, notify, pushToast]);

  const handleQuickPick = (symbol: string) => {
    setActiveTab("trade");
    setBuyPresetSelection({
      symbol,
      requestId: Date.now()
    });
    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
  };

  return (
    <main className="page-shell">
      <ToastStack toasts={toasts} onDismiss={dismissToast} />

      <section className="hero-panel">
        <div className="hero-copy">
          <p className="eyebrow">KIS + Codex Trade Station</p>
          <h1>AI 5% Trader</h1>
          <p className="hero-description">
            원하는 미국 종목을 원클릭으로 매수하면 그 수량만 별도로 추적해서 목표 수익률 도달 시 자동 매도 주문을 내고,
            미국 우량주/테마/섹터 데이터를 코덱스로 해석해 대시보드에 보여줍니다.
          </p>
        </div>
        <div className="hero-meta">
          <div className="hero-stat">
            <span>최근 시장 분석</span>
            <strong>
              {data.market.blueChips.length > 0
                ? new Date(data.market.analysisGeneratedAt).toLocaleString()
                : "분석 준비 중"}
            </strong>
          </div>
          <div className="hero-stat">
            <span>자동매도 상태</span>
            <strong>{data.trading.monitorRunning ? "RUNNING" : "IDLE"}</strong>
          </div>
          <div className="hero-stat">
            <span>계좌 보유</span>
            <strong>
              종목 {data.trading.accountSummary.heldSymbolCount}개 / 총 {data.trading.accountSummary.totalHoldingQuantity.toFixed(0)}주
            </strong>
          </div>
          <div className="hero-stat">
            <span>주문 가능 현금</span>
            <strong>{usdCurrency.format(data.trading.accountSummary.orderableCashUsd)}</strong>
          </div>
          <div className="hero-stat">
            <span>Codex 로그인</span>
            <strong>{data.llm.loginStatus || "확인 중"}</strong>
          </div>
          <div className="hero-actions">
            <button
              className="primary-button hero-button"
              onClick={() => void refresh()}
              disabled={refreshing}
            >
              전체 새로고침
            </button>
            {desktopNotificationSupported && desktopNotificationPermission === "default" ? (
              <button
                className="ghost-button hero-button"
                onClick={() => {
                  void requestDesktopNotificationPermission();
                }}
              >
                데스크톱 알림 켜기
              </button>
            ) : null}
            {desktopNotificationSupported && desktopNotificationPermission === "granted" ? (
              <span className="sync-status">데스크톱 알림 사용 중.</span>
            ) : null}
            {desktopNotificationSupported && desktopNotificationPermission === "denied" ? (
              <span className="sync-status">데스크톱 알림이 브라우저에서 차단되어 있습니다.</span>
            ) : null}
            {!desktopNotificationSupported ? (
              <span className="sync-status">이 브라우저는 데스크톱 알림을 지원하지 않습니다.</span>
            ) : null}
            <span className="sync-status">계좌 상태 새로고침하며 확인중.</span>
          </div>
        </div>
      </section>

      <DashboardTabs activeTab={activeTab} tabs={DASHBOARD_TABS} onChange={setActiveTab} />

      {error ? <p className="error-banner">{error}</p> : null}

      {activeTab === "trade" ? (
        <TradingWorkspace
          trading={data.trading}
          refreshingDetails={refreshing}
          usdKrwRate={data.market.usdKrwRate}
          usdKrwUpdatedAt={data.market.usdKrwUpdatedAt}
          favorites={favorites}
          presetSelection={buyPresetSelection}
          onQuickPick={handleQuickPick}
          onRemoveFavorite={removeFavorite}
          onAddFavorite={addFavorite}
          isFavorite={isFavorite}
          onPrecheck={precheckOneClickBuy}
          onSubmit={submitOneClickBuy}
          onCancelTarget={cancelAutoSellTarget}
          onModifyBuyOrder={modifyBuyOrder}
          onCancelBuyOrder={cancelBuyOrder}
          onRefreshDetails={refresh}
        />
      ) : null}

      {activeTab === "account" ? <AccountWorkspace trading={data.trading} /> : null}

      {activeTab === "market" ? (
        <MarketWorkspace market={data.market} llm={data.llm} onQuickPick={handleQuickPick} />
      ) : null}
    </main>
  );
}
