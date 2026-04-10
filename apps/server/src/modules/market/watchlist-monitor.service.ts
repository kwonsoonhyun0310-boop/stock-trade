import type { WatchlistMonitorSnapshot, WatchlistQuote, WatchlistSymbolInput } from "@trade/shared";
import YahooFinance from "yahoo-finance2";
import { normalizeQuotes } from "./market-price-history.js";
import { getUsRegularMarketState } from "./market-session.js";

const financeApi = new (YahooFinance as any)({
  suppressNotices: ["yahooSurvey", "ripHistorical"]
});

interface CachedWatchlistQuote {
  expiresAt: number;
  promise: Promise<WatchlistQuote>;
}

const REGULAR_MARKET_CACHE_MS = 45_000;
const OFF_HOURS_CACHE_MS = 15 * 60 * 1000;

const toNumber = (value: unknown) => {
  const nextValue = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(nextValue) ? nextValue : 0;
};

const dedupeInputs = (inputs: WatchlistSymbolInput[]) => {
  const byKey = new Map<string, WatchlistSymbolInput>();

  for (const input of inputs) {
    const symbol = input.symbol.trim().toUpperCase();

    if (!symbol) {
      continue;
    }

    byKey.set(`${input.exchange}:${symbol}`, {
      ...input,
      symbol
    });
  }

  return [...byKey.values()];
};

const getMomentumTone = (dayChangePercent: number, oneMonthReturn: number, threeMonthReturn: number) => {
  if (dayChangePercent >= 1.5 || (oneMonthReturn >= 4 && threeMonthReturn >= 2)) {
    return "positive" as const;
  }

  if (dayChangePercent <= -1.5 || (oneMonthReturn <= -4 && threeMonthReturn <= -2)) {
    return "negative" as const;
  }

  return "neutral" as const;
};

const getMonitoringLabel = (
  tone: WatchlistQuote["momentumTone"],
  dayChangePercent: number,
  oneMonthReturn: number
) => {
  if (tone === "positive") {
    return dayChangePercent >= 1.5 ? "오늘 강하게 오르는 중" : "최근 흐름이 강한 종목";
  }

  if (tone === "negative") {
    return dayChangePercent <= -1.5 ? "오늘 약세가 강한 종목" : "최근 흐름이 약한 종목";
  }

  if (Math.abs(oneMonthReturn) < 2) {
    return "큰 방향 없이 관찰 중";
  }

  return "방향 확인이 필요한 종목";
};

export class WatchlistMonitorService {
  private readonly cache = new Map<string, CachedWatchlistQuote>();

  async getSnapshot(inputs: WatchlistSymbolInput[]): Promise<WatchlistMonitorSnapshot> {
    const normalizedInputs = dedupeInputs(inputs);
    const items = await Promise.all(
      normalizedInputs.map(async (input) => {
        try {
          return await this.loadQuote(input);
        } catch {
          return null;
        }
      })
    );

    return {
      updatedAt: new Date().toISOString(),
      items: items.flatMap((item) => (item ? [item] : []))
    };
  }

  private async loadQuote(input: WatchlistSymbolInput): Promise<WatchlistQuote> {
    const key = `${input.exchange}:${input.symbol}`;
    const cached = this.cache.get(key);

    if (cached && cached.expiresAt > Date.now()) {
      return cached.promise;
    }

    const ttl = getUsRegularMarketState().isRegularOpen ? REGULAR_MARKET_CACHE_MS : OFF_HOURS_CACHE_MS;
    const pending = this.fetchQuote(input).catch((error) => {
      this.cache.delete(key);
      throw error;
    });

    this.cache.set(key, {
      expiresAt: Date.now() + ttl,
      promise: pending
    });

    return pending;
  }

  private async fetchQuote(input: WatchlistSymbolInput): Promise<WatchlistQuote> {
    const [quote, recentChart] = (await Promise.all([
      financeApi.quote(input.symbol),
      financeApi.chart(input.symbol, {
        period1: new Date(Date.now() - 95 * 24 * 60 * 60 * 1000),
        period2: new Date(),
        interval: "1d"
      })
    ])) as [
      {
        regularMarketPrice?: number;
        postMarketPrice?: number;
        preMarketPrice?: number;
        regularMarketPreviousClose?: number;
        regularMarketChange?: number;
        regularMarketChangePercent?: number;
      },
      { quotes?: Array<{ date?: Date | string; close?: number | null }> }
    ];

    const recentSeries = normalizeQuotes(recentChart.quotes ?? []);
    const fallbackPrice = recentSeries.at(-1)?.close ?? 0;
    const currentPrice = toNumber(
      quote.regularMarketPrice ?? quote.postMarketPrice ?? quote.preMarketPrice ?? fallbackPrice
    );
    const previousClose = toNumber(quote.regularMarketPreviousClose ?? recentSeries.at(-2)?.close ?? currentPrice);
    const dayChangeUsd =
      toNumber(quote.regularMarketChange) || (previousClose > 0 ? currentPrice - previousClose : 0);
    const dayChangePercent =
      toNumber(quote.regularMarketChangePercent) ||
      (previousClose > 0 ? ((currentPrice - previousClose) / previousClose) * 100 : 0);
    const oneMonthBase = recentSeries.at(Math.max(0, recentSeries.length - 22))?.close ?? currentPrice;
    const threeMonthBase = recentSeries.at(0)?.close ?? currentPrice;
    const oneMonthReturn = oneMonthBase > 0 ? ((currentPrice - oneMonthBase) / oneMonthBase) * 100 : 0;
    const threeMonthReturn =
      threeMonthBase > 0 ? ((currentPrice - threeMonthBase) / threeMonthBase) * 100 : 0;
    const momentumTone = getMomentumTone(dayChangePercent, oneMonthReturn, threeMonthReturn);

    return {
      symbol: input.symbol,
      name: input.name,
      exchange: input.exchange,
      exchangeLabel: input.exchangeLabel,
      currentPrice: Number(currentPrice.toFixed(2)),
      previousClose: Number(previousClose.toFixed(2)),
      dayChangeUsd: Number(dayChangeUsd.toFixed(2)),
      dayChangePercent: Number(dayChangePercent.toFixed(2)),
      oneMonthReturn: Number(oneMonthReturn.toFixed(2)),
      threeMonthReturn: Number(threeMonthReturn.toFixed(2)),
      monitoringLabel: getMonitoringLabel(momentumTone, dayChangePercent, oneMonthReturn),
      momentumTone,
      lastUpdatedAt: new Date().toISOString()
    };
  }
}
