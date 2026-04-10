import { useEffect, useState } from "react";
import type { ExchangeCode } from "@trade/shared";
import type { FavoriteSymbol } from "../lib/favorite-symbols.js";
import { favoriteSymbolKey } from "../lib/favorite-symbols.js";

const STORAGE_KEY = "trade.favorite-symbols.v1";

const readFavorites = () => {
  if (typeof window === "undefined") {
    return [] as FavoriteSymbol[];
  }

  try {
    const rawValue = window.localStorage.getItem(STORAGE_KEY);

    if (!rawValue) {
      return [] as FavoriteSymbol[];
    }

    const parsedValue = JSON.parse(rawValue) as FavoriteSymbol[];
    return Array.isArray(parsedValue) ? parsedValue : [];
  } catch {
    return [] as FavoriteSymbol[];
  }
};

export function useFavoriteSymbols() {
  const [favorites, setFavorites] = useState<FavoriteSymbol[]>(readFavorites);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(favorites));
  }, [favorites]);

  const addFavorite = (favorite: Omit<FavoriteSymbol, "savedAt">) => {
    const savedAt = new Date().toISOString();

    setFavorites((current) => {
      const nextFavorite: FavoriteSymbol = {
        ...favorite,
        symbol: favorite.symbol.trim().toUpperCase(),
        savedAt
      };
      const nextKey = favoriteSymbolKey(nextFavorite.symbol, nextFavorite.exchange);
      const nextFavorites = current.filter(
        (entry) => favoriteSymbolKey(entry.symbol, entry.exchange) !== nextKey
      );

      return [nextFavorite, ...nextFavorites].slice(0, 18);
    });
  };

  const removeFavorite = (symbol: string, exchange: ExchangeCode) => {
    setFavorites((current) =>
      current.filter(
        (entry) => favoriteSymbolKey(entry.symbol, entry.exchange) !== favoriteSymbolKey(symbol, exchange)
      )
    );
  };

  const isFavorite = (symbol: string, exchange: ExchangeCode) =>
    favorites.some(
      (entry) => favoriteSymbolKey(entry.symbol, entry.exchange) === favoriteSymbolKey(symbol, exchange)
    );

  return {
    favorites,
    addFavorite,
    removeFavorite,
    isFavorite
  };
}
