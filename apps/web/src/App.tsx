import { AnalysisPanel } from "./components/analysis-panel.js";
import { AutoSellPanel } from "./components/auto-sell-panel.js";
import { EventsList } from "./components/events-list.js";
import { HoldingsTable } from "./components/holdings-table.js";
import { RankingPanel } from "./components/ranking-panel.js";
import { TradeTicket } from "./components/trade-ticket.js";
import { useDashboard } from "./hooks/use-dashboard.js";

export default function App() {
  const { data, error, refreshing, refresh, submitOrder, updateSettings } = useDashboard();

  return (
    <main className="page-shell">
      <section className="hero-panel">
        <div className="hero-copy">
          <p className="eyebrow">KIS + Codex Trade Station</p>
          <h1>매수 후 +5% 자동매도와 미국주식 트렌드 분석을 한 화면에서</h1>
          <p className="hero-description">
            한국투자증권 해외주식 계좌를 폴링해서 목표 수익률 도달 시 자동 매도 주문을 내고,
            미국 우량주/테마/섹터 데이터를 코덱스로 해석해 대시보드에 보여줍니다.
          </p>
        </div>
        <div className="hero-meta">
          <div className="hero-stat">
            <span>최근 시장 분석</span>
            <strong>
              {data.market.blueChips.length > 0
                ? new Date(data.market.generatedAt).toLocaleString()
                : "분석 준비 중"}
            </strong>
          </div>
          <div className="hero-stat">
            <span>자동매도 상태</span>
            <strong>{data.trading.monitorRunning ? "RUNNING" : "IDLE"}</strong>
          </div>
          <div className="hero-stat">
            <span>Codex 로그인</span>
            <strong>{data.llm.loginStatus || "확인 중"}</strong>
          </div>
          <button className="primary-button hero-button" onClick={() => void refresh()}>
            {refreshing ? "동기화 중" : "전체 새로고침"}
          </button>
        </div>
      </section>

      {error ? <p className="error-banner">{error}</p> : null}

      <section className="top-grid">
        <div className="stack-grid">
          <TradeTicket onSubmit={submitOrder} />
          <AutoSellPanel
            trading={data.trading}
            onSave={updateSettings}
            onRefresh={refresh}
            refreshing={refreshing}
          />
        </div>

        <AnalysisPanel
          sections={data.market.analysis}
          loginStatus={data.llm.loginStatus}
          model={data.llm.model}
        />
      </section>

      <section className="triple-grid">
        <RankingPanel title="미국 우량주 Top 10" eyebrow="Blue Chips" items={data.market.blueChips} />
        <RankingPanel
          title="현재 트렌드 강한 분야 Top 10"
          eyebrow="Trending Themes"
          items={data.market.trendingThemes}
        />
        <RankingPanel
          title="섹터 리더보드 Top 10"
          eyebrow="Sector Leaders"
          items={data.market.sectorLeaders}
        />
      </section>

      <section className="bottom-grid">
        <HoldingsTable holdings={data.trading.holdings} />
        <EventsList events={data.trading.recentEvents} />
      </section>
    </main>
  );
}
