import type { RankedAsset } from "@trade/shared";

interface RankingPanelProps {
  title: string;
  eyebrow: string;
  items: RankedAsset[];
}

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2
});

export function RankingPanel({ title, eyebrow, items }: RankingPanelProps) {
  const maxScore = Math.max(...items.map((item) => item.score), 1);

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h2>{title}</h2>
        </div>
      </div>

      {items.length === 0 ? (
        <p className="empty-state">시장 데이터 로딩 중입니다.</p>
      ) : (
      <ol className="ranking-list">
        {items.map((item, index) => (
          <li key={item.symbol} className="ranking-row">
            <div className="ranking-index">{String(index + 1).padStart(2, "0")}</div>
            <div className="ranking-body">
              <div className="ranking-topline">
                <div>
                  <strong>{item.symbol}</strong>
                  <span>{item.name}</span>
                </div>
                <div className="ranking-score">{item.score.toFixed(1)}</div>
              </div>
              <div className="ranking-bar">
                <span style={{ width: `${(item.score / maxScore) * 100}%` }} />
              </div>
              <div className="ranking-meta">
                <span>{item.category}</span>
                <span>{currency.format(item.currentPrice)}</span>
                <span>1M {item.oneMonthReturn.toFixed(1)}%</span>
                <span>3M {item.threeMonthReturn.toFixed(1)}%</span>
              </div>
            </div>
          </li>
        ))}
      </ol>
      )}
    </section>
  );
}
