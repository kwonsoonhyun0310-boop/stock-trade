import { useState } from "react";
import type { RankedAsset } from "@trade/shared";
import { PriceTrendChart } from "./price-trend-chart.js";

interface RankingPanelProps {
  title: string;
  eyebrow: string;
  items: RankedAsset[];
  onQuickPick?: (symbol: string) => void;
  collapsible?: boolean;
}

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2
});

const buildCollapsedSummary = (items: RankedAsset[]) => {
  if (items.length === 0) {
    return "시장 데이터가 아직 준비되지 않았습니다.";
  }

  const leaders = items
    .slice(0, 3)
    .map((item, index) => `${index + 1}. ${item.nameKo || item.name} (${item.symbol})`)
    .join(", ");

  return `상위 3개: ${leaders}`;
};

export function RankingPanel({
  title,
  eyebrow,
  items,
  onQuickPick,
  collapsible = false
}: RankingPanelProps) {
  const [expanded, setExpanded] = useState(!collapsible);
  const maxScore = Math.max(...items.map((item) => item.score), 1);
  const collapsedSummary = buildCollapsedSummary(items);

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h2>{title}</h2>
        </div>
        {collapsible ? (
          <button
            type="button"
            className="ghost-button ranking-toggle-button"
            onClick={() => setExpanded((current) => !current)}
          >
            {expanded ? "접기" : "펼치기"}
          </button>
        ) : null}
      </div>

      {items.length === 0 ? (
        <p className="empty-state">시장 데이터 로딩 중입니다.</p>
      ) : !expanded ? (
        <div className="ranking-collapsed-summary">
          <p>{collapsedSummary}</p>
        </div>
      ) : (
        <ol className="ranking-list">
          {items.map((item, index) => (
            <li key={item.symbol} className="ranking-row">
              <div className="ranking-index">{String(index + 1).padStart(2, "0")}</div>
              <div className="ranking-body">
                <div className="ranking-topline">
                  <div className="ranking-title-block">
                    <strong>{item.symbol}</strong>
                    <span>{item.name}</span>
                    <span className="ranking-name-ko">{item.nameKo}</span>
                  </div>
                  <div className="ranking-score">{item.score.toFixed(1)}</div>
                </div>
                <p className="ranking-description">{item.descriptionKo}</p>
                <div className="ranking-bar">
                  <span style={{ width: `${(item.score / maxScore) * 100}%` }} />
                </div>
                <div className="ranking-meta">
                  <span>{item.category}</span>
                  <span>{item.metricLabel ?? currency.format(item.currentPrice)}</span>
                </div>
                {onQuickPick ? (
                  <div className="ranking-actions">
                    <button
                      type="button"
                      className="ghost-button ranking-quick-buy"
                      onClick={() => onQuickPick(item.symbol)}
                    >
                      이 종목으로 매수창 채우기
                    </button>
                  </div>
                ) : null}
                <PriceTrendChart
                  points={item.priceHistory}
                  extendedPoints={item.extendedPriceHistory}
                  intradayPoints={item.intradayPriceHistory}
                  metricLabel={item.metricLabel}
                />
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
