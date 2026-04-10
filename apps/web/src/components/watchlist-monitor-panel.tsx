import type { WatchlistMonitorSnapshot } from "@trade/shared";
import type { FavoriteSymbol } from "../lib/favorite-symbols.js";

interface WatchlistMonitorPanelProps {
  favorites: FavoriteSymbol[];
  snapshot: WatchlistMonitorSnapshot;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  onQuickPick: (symbol: string) => void;
  onRemove: (symbol: string, exchange: FavoriteSymbol["exchange"]) => void;
  onRefresh: () => Promise<void>;
}

const usdCurrency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2
});

const signedPercent = new Intl.NumberFormat("ko-KR", {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
  signDisplay: "always"
});

const signedUsd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
  signDisplay: "always"
});

const getToneClassName = (tone: WatchlistMonitorSnapshot["items"][number]["momentumTone"]) => {
  switch (tone) {
    case "positive":
      return "watchlist-pill positive";
    case "negative":
      return "watchlist-pill negative";
    default:
      return "watchlist-pill neutral";
  }
};

const getValueToneClassName = (value: number) =>
  value > 0 ? "profit-up" : value < 0 ? "profit-down" : "profit-neutral";

export function WatchlistMonitorPanel({
  favorites,
  snapshot,
  loading,
  refreshing,
  error,
  onQuickPick,
  onRemove,
  onRefresh
}: WatchlistMonitorPanelProps) {
  const watchlistByKey = new Map(
    snapshot.items.map((item) => [`${item.exchange}:${item.symbol}`, item])
  );

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Watchlist</p>
          <h2>관심종목 감시</h2>
          <p className="empty-state compact-empty-state">
            즐겨찾기 종목의 현재가와 최근 한 달, 세 달 흐름을 자동으로 확인합니다.
          </p>
        </div>
        <div className="panel-inline-actions">
          <span className="sync-status">
            {favorites.length === 0
              ? "관심종목을 추가하면 감시를 시작합니다."
              : `60초마다 자동 갱신 · 마지막 확인 ${new Date(snapshot.updatedAt).toLocaleTimeString()}`}
          </span>
          <button
            type="button"
            className="ghost-button panel-inline-button"
            onClick={() => void onRefresh()}
            disabled={refreshing || favorites.length === 0}
          >
            {refreshing ? "갱신 중" : "지금 갱신"}
          </button>
        </div>
      </div>

      {error ? <p className="error-text watchlist-error">{error}</p> : null}

      {favorites.length === 0 ? (
        <p className="empty-state">원클릭 매수 패널에서 종목을 즐겨찾기에 저장하면 여기서 바로 감시할 수 있습니다.</p>
      ) : loading && snapshot.items.length === 0 ? (
        <p className="empty-state">관심종목 시세를 불러오는 중입니다.</p>
      ) : (
        <ul className="watchlist-grid">
          {favorites.map((favorite) => {
            const item = watchlistByKey.get(`${favorite.exchange}:${favorite.symbol}`);

            return (
              <li key={`${favorite.exchange}-${favorite.symbol}`} className="watchlist-card">
                <div className="watchlist-card-header">
                  <div>
                    <strong>{favorite.symbol}</strong>
                    <span>{favorite.name}</span>
                  </div>
                  <div className="watchlist-card-badges">
                    <span className="favorite-badge">{favorite.exchangeLabel}</span>
                    {item ? (
                      <span className={getToneClassName(item.momentumTone)}>{item.monitoringLabel}</span>
                    ) : (
                      <span className="watchlist-pill neutral">시세 확인 중</span>
                    )}
                  </div>
                </div>

                {item ? (
                  <>
                    <div className="watchlist-price-row">
                      <strong>{usdCurrency.format(item.currentPrice)}</strong>
                      <span className={getValueToneClassName(item.dayChangePercent)}>
                        {signedUsd.format(item.dayChangeUsd)} / {signedPercent.format(item.dayChangePercent)}%
                      </span>
                    </div>

                    <div className="watchlist-metrics">
                      <article className="watchlist-metric-card">
                        <span>전일 종가</span>
                        <strong>{usdCurrency.format(item.previousClose)}</strong>
                      </article>
                      <article className="watchlist-metric-card">
                        <span>한 달 흐름</span>
                        <strong className={getValueToneClassName(item.oneMonthReturn)}>
                          {signedPercent.format(item.oneMonthReturn)}%
                        </strong>
                      </article>
                      <article className="watchlist-metric-card">
                        <span>세 달 흐름</span>
                        <strong className={getValueToneClassName(item.threeMonthReturn)}>
                          {signedPercent.format(item.threeMonthReturn)}%
                        </strong>
                      </article>
                    </div>

                    <p className="watchlist-meta">
                      최근 갱신 {new Date(item.lastUpdatedAt).toLocaleTimeString()} · 저장 {new Date(favorite.savedAt).toLocaleString()}
                    </p>
                  </>
                ) : (
                  <p className="watchlist-meta">아직 이 종목 시세를 불러오지 못했습니다. 잠시 뒤 다시 확인합니다.</p>
                )}

                <div className="favorite-card-actions">
                  <button
                    type="button"
                    className="ghost-button favorite-action-button"
                    onClick={() => onQuickPick(favorite.symbol)}
                  >
                    매수창 채우기
                  </button>
                  <button
                    type="button"
                    className="ghost-button favorite-action-button"
                    onClick={() => onRemove(favorite.symbol, favorite.exchange)}
                  >
                    삭제
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
