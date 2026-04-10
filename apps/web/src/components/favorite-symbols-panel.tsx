import type { FavoriteSymbol } from "../lib/favorite-symbols.js";

interface FavoriteSymbolsPanelProps {
  favorites: FavoriteSymbol[];
  onQuickPick: (symbol: string) => void;
  onRemove: (symbol: string, exchange: FavoriteSymbol["exchange"]) => void;
}

export function FavoriteSymbolsPanel({
  favorites,
  onQuickPick,
  onRemove
}: FavoriteSymbolsPanelProps) {
  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Favorites</p>
          <h2>즐겨찾기 종목</h2>
        </div>
      </div>

      {favorites.length === 0 ? (
        <p className="empty-state">원클릭 매수 패널에서 종목을 선택한 뒤 즐겨찾기에 저장할 수 있습니다.</p>
      ) : (
        <ul className="favorite-list">
          {favorites.map((favorite) => (
            <li key={`${favorite.exchange}-${favorite.symbol}`} className="favorite-card">
              <div className="favorite-card-head">
                <div>
                  <strong>{favorite.symbol}</strong>
                  <span>{favorite.name}</span>
                </div>
                <span className="favorite-badge">{favorite.exchangeLabel}</span>
              </div>
              <div className="favorite-card-meta">
                <span>저장 시각 {new Date(favorite.savedAt).toLocaleString()}</span>
              </div>
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
          ))}
        </ul>
      )}
    </section>
  );
}
