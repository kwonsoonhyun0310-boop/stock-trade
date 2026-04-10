import type { ExchangeCode } from "@trade/shared";

export interface FavoriteSymbol {
  symbol: string;
  name: string;
  exchange: ExchangeCode;
  exchangeLabel: string;
  savedAt: string;
}

export const favoriteSymbolKey = (symbol: string, exchange: ExchangeCode) =>
  `${exchange}:${symbol.trim().toUpperCase()}`;
