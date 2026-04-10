import type {
  ExchangeCode,
  OneClickBuyPrecheckResponse,
  OneClickBuyRequest,
  OneClickBuyResponse,
  TradingStatus
} from "@trade/shared";
import { AutoSellPanel } from "./auto-sell-panel.js";
import { FavoriteSymbolsPanel } from "./favorite-symbols-panel.js";
import { OneClickBuyPanel } from "./one-click-buy-panel.js";
import { OrderStatusPanel } from "./order-status-panel.js";
import type { FavoriteSymbol } from "../lib/favorite-symbols.js";

interface TradingWorkspaceProps {
  trading: TradingStatus;
  refreshingDetails: boolean;
  usdKrwRate: number;
  usdKrwUpdatedAt?: string;
  favorites: FavoriteSymbol[];
  presetSelection?: {
    symbol: string;
    requestId: number;
  } | null;
  onQuickPick: (symbol: string) => void;
  onRemoveFavorite: (symbol: string, exchange: FavoriteSymbol["exchange"]) => void;
  onAddFavorite: (favorite: Omit<FavoriteSymbol, "savedAt">) => void;
  isFavorite: (symbol: string, exchange: ExchangeCode) => boolean;
  onPrecheck: (order: OneClickBuyRequest) => Promise<OneClickBuyPrecheckResponse>;
  onSubmit: (order: OneClickBuyRequest) => Promise<OneClickBuyResponse>;
  onCancelTarget: (targetId: string) => Promise<void>;
  onModifyBuyOrder: (targetId: string, limitPrice: number) => Promise<void>;
  onCancelBuyOrder: (targetId: string) => Promise<void>;
  onRefreshDetails: () => Promise<void>;
}

export function TradingWorkspace({
  trading,
  refreshingDetails,
  usdKrwRate,
  usdKrwUpdatedAt,
  favorites,
  presetSelection,
  onQuickPick,
  onRemoveFavorite,
  onAddFavorite,
  isFavorite,
  onPrecheck,
  onSubmit,
  onCancelTarget,
  onModifyBuyOrder,
  onCancelBuyOrder,
  onRefreshDetails
}: TradingWorkspaceProps) {
  return (
    <section className="tab-panel-stack">
      <section className="top-grid">
        <div className="stack-grid">
          <OneClickBuyPanel
            targetProfitPercent={trading.settings.targetProfitPercent}
            usdKrwRate={usdKrwRate}
            usdKrwUpdatedAt={usdKrwUpdatedAt}
            presetSelection={presetSelection}
            onAddFavorite={onAddFavorite}
            isFavorite={isFavorite}
            onPrecheck={onPrecheck}
            onSubmit={onSubmit}
          />
          <FavoriteSymbolsPanel
            favorites={favorites}
            onQuickPick={onQuickPick}
            onRemove={onRemoveFavorite}
          />
        </div>

        <div className="stack-grid">
          <AutoSellPanel
            trading={trading}
            refreshingDetails={refreshingDetails}
            onCancelTarget={onCancelTarget}
            onModifyBuyOrder={onModifyBuyOrder}
            onCancelBuyOrder={onCancelBuyOrder}
            onRefreshDetails={onRefreshDetails}
          />
          <OrderStatusPanel trading={trading} />
        </div>
      </section>
    </section>
  );
}
