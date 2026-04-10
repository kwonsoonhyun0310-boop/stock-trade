import type { DashboardResponse, MarketDashboard } from "@trade/shared";
import { AnalysisPanel } from "./analysis-panel.js";
import { RankingPanel } from "./ranking-panel.js";

interface MarketWorkspaceProps {
  market: MarketDashboard;
  llm: DashboardResponse["llm"];
  onQuickPick: (symbol: string) => void;
}

export function MarketWorkspace({ market, llm, onQuickPick }: MarketWorkspaceProps) {
  return (
    <section className="tab-panel-stack">
      <AnalysisPanel
        history={market.analysisHistory}
        generatedAt={market.analysisGeneratedAt}
        loginStatus={llm.loginStatus}
        model={llm.model}
      />

      <section className="triple-grid">
        <RankingPanel
          title="미국 우량주 Top 10"
          eyebrow="Blue Chips"
          items={market.blueChips}
          onQuickPick={onQuickPick}
          collapsible
        />
        <RankingPanel
          title="현재 트렌드 강한 분야 Top 10"
          eyebrow="Trending Themes"
          items={market.trendingThemes}
          onQuickPick={onQuickPick}
          collapsible
        />
        <RankingPanel
          title="섹터 리더보드 Top 10"
          eyebrow="Sector Leaders"
          items={market.sectorLeaders}
          onQuickPick={onQuickPick}
          collapsible
        />
      </section>

      <section className="section-gap">
        <RankingPanel
          title="ETF 제외 순수 오름세 분야 Top 10"
          eyebrow="Pure Industry Momentum"
          items={market.industryMomentumLeaders}
          collapsible
        />
      </section>
    </section>
  );
}
