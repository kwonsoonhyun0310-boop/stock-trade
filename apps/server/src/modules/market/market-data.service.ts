import type { RankedAsset } from "@trade/shared";
import YahooFinance from "yahoo-finance2";
import type { AssetSeed, IndustryGroupSeed } from "./market-universes.js";
import {
  BLUE_CHIP_UNIVERSE,
  INDUSTRY_MOMENTUM_UNIVERSE,
  SECTOR_UNIVERSE,
  TRENDING_THEME_UNIVERSE
} from "./market-universes.js";
import {
  buildExtendedPriceHistory,
  buildIntradayPriceHistory,
  buildPriceHistory,
  normalizeIntradayQuotes,
  normalizeQuotes,
  type NormalizedClosePoint
} from "./market-price-history.js";
import { getUsRegularMarketState } from "./market-session.js";

const financeApi = new (YahooFinance as any)({
  suppressNotices: ["yahooSurvey", "ripHistorical"]
});

interface EnrichedAsset extends RankedAsset {
  operatingMargin?: number;
  returnOnEquity?: number;
  dividendYield?: number;
  averageVolume?: number;
}

interface SymbolMarketSnapshot {
  currentPrice: number;
  marketCap: number;
  averageVolume: number;
  recentSeries: NormalizedClosePoint[];
  longTermSeries: NormalizedClosePoint[];
  intradaySeries: NormalizedClosePoint[];
}

interface SymbolFundamentals {
  operatingMargin: number;
  returnOnEquity: number;
  dividendYield: number;
}

interface IndustryMemberSnapshot extends SymbolMarketSnapshot {
  symbol: string;
}

interface FxSnapshot {
  usdKrwRate: number;
  updatedAt: string;
}

const percentileScore = (value: number, values: number[]) => {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const position = sorted.findIndex((candidate) => candidate >= value);
  const index = position === -1 ? sorted.length - 1 : position;
  return sorted.length === 1 ? 1 : index / (sorted.length - 1);
};

const formatPercent = (value?: number) => `${(value ?? 0).toFixed(1)}%`;
const formatReturnNote = (label: string, value: number) =>
  `${label} ${Math.abs(value).toFixed(1)}% ${value >= 0 ? "높아요" : "낮아요"}`;
const formatVolumeNote = (value: number) => {
  if (value >= 100_000_000) {
    return `하루 평균 거래량 약 ${(value / 100_000_000).toFixed(1)}억주`;
  }

  if (value >= 10_000) {
    return `하루 평균 거래량 약 ${(value / 10_000).toFixed(0)}만주`;
  }

  return `하루 평균 거래량 약 ${value.toFixed(0)}주`;
};

export class MarketDataService {
  private marketSnapshotRefreshKey = "";
  private fundamentalsDateKey = "";
  private readonly marketSnapshotCache = new Map<string, Promise<SymbolMarketSnapshot>>();
  private readonly fundamentalsCache = new Map<string, Promise<SymbolFundamentals>>();
  private fxSnapshotPromise?: Promise<FxSnapshot>;

  async getBlueChipLeaders(): Promise<RankedAsset[]> {
    this.ensureFreshCaches();
    const assets = await this.enrichUniverse(BLUE_CHIP_UNIVERSE, true);
    return this.scoreAndTrim(assets, "bluechip");
  }

  async getTrendingThemes(): Promise<RankedAsset[]> {
    this.ensureFreshCaches();
    const assets = await this.enrichUniverse(TRENDING_THEME_UNIVERSE, false);
    return this.scoreAndTrim(assets, "themes");
  }

  async getSectorLeaders(): Promise<RankedAsset[]> {
    this.ensureFreshCaches();
    const assets = await this.enrichUniverse(SECTOR_UNIVERSE, false);
    return this.scoreAndTrim(assets, "sectors");
  }

  async getIndustryMomentumLeaders(): Promise<RankedAsset[]> {
    this.ensureFreshCaches();

    const results = await Promise.allSettled(
      INDUSTRY_MOMENTUM_UNIVERSE.map((industry) => this.enrichIndustryGroup(industry))
    );

    const assets = results.flatMap((result) => (result.status === "fulfilled" ? [result.value] : []));
    return this.scoreAndTrim(assets, "industries");
  }

  async getUsdKrwSnapshot(): Promise<FxSnapshot> {
    this.ensureFreshCaches();

    if (this.fxSnapshotPromise) {
      return this.fxSnapshotPromise;
    }

    this.fxSnapshotPromise = (async () => {
      const quote = await financeApi.quote("KRW=X");
      const usdKrwRate = Number(
        quote.regularMarketPrice ?? quote.postMarketPrice ?? quote.preMarketPrice ?? 0
      );

      return {
        usdKrwRate,
        updatedAt: new Date().toISOString()
      };
    })();

    return this.fxSnapshotPromise;
  }

  private ensureFreshCaches() {
    const refreshKey = getUsRegularMarketState().refreshKey;
    const today = new Date().toISOString().slice(0, 10);

    if (this.marketSnapshotRefreshKey !== refreshKey) {
      this.marketSnapshotRefreshKey = refreshKey;
      this.marketSnapshotCache.clear();
      this.fxSnapshotPromise = undefined;
    }

    if (this.fundamentalsDateKey !== today) {
      this.fundamentalsDateKey = today;
      this.fundamentalsCache.clear();
    }
  }

  private async enrichUniverse(
    universe: AssetSeed[],
    withFundamentals: boolean
  ): Promise<EnrichedAsset[]> {
    const results = await Promise.allSettled(
      universe.map((asset) => this.enrichAsset(asset, withFundamentals))
    );

    return results.flatMap((result) => (result.status === "fulfilled" ? [result.value] : []));
  }

  private async enrichAsset(seed: AssetSeed, withFundamentals: boolean): Promise<EnrichedAsset> {
    const snapshot = await this.loadMarketSnapshot(seed.symbol);
    const fundamentals = withFundamentals
      ? await this.loadFundamentals(seed.symbol)
      : { operatingMargin: 0, returnOnEquity: 0, dividendYield: 0 };

    const recentCloses = snapshot.recentSeries.map((point) => point.close);
    const currentPrice = snapshot.currentPrice;
    const oneMonthBase = recentCloses.at(Math.max(0, recentCloses.length - 22)) ?? currentPrice;
    const threeMonthBase = recentCloses.at(0) ?? currentPrice;
    const oneMonthReturn = oneMonthBase > 0 ? ((currentPrice - oneMonthBase) / oneMonthBase) * 100 : 0;
    const threeMonthReturn =
      threeMonthBase > 0 ? ((currentPrice - threeMonthBase) / threeMonthBase) * 100 : 0;

    const notes = [
      formatReturnNote("한 달 전보다", oneMonthReturn),
      formatReturnNote("세 달 전보다", threeMonthReturn),
      withFundamentals
        ? `영업이익 비율 ${formatPercent(fundamentals.operatingMargin)} / 자기자본 수익률 ${formatPercent(fundamentals.returnOnEquity)}`
        : formatVolumeNote(snapshot.averageVolume)
    ];

    return {
      symbol: seed.symbol,
      name: seed.name,
      nameKo: seed.nameKo,
      category: seed.category,
      descriptionKo: seed.descriptionKo,
      currentPrice,
      metricLabel: undefined,
      marketCap: snapshot.marketCap,
      oneMonthReturn,
      threeMonthReturn,
      priceHistory: buildPriceHistory(
        snapshot.recentSeries,
        currentPrice,
        oneMonthReturn,
        threeMonthReturn
      ),
      extendedPriceHistory: buildExtendedPriceHistory(
        snapshot.longTermSeries,
        currentPrice,
        oneMonthReturn,
        threeMonthReturn
      ),
      intradayPriceHistory: buildIntradayPriceHistory(snapshot.intradaySeries, currentPrice),
      score: 0,
      notes,
      operatingMargin: fundamentals.operatingMargin,
      returnOnEquity: fundamentals.returnOnEquity,
      dividendYield: fundamentals.dividendYield,
      averageVolume: snapshot.averageVolume
    };
  }

  private async enrichIndustryGroup(seed: IndustryGroupSeed): Promise<EnrichedAsset> {
    const results = await Promise.allSettled(
      seed.members.map(async (symbol) => ({
        symbol,
        ...(await this.loadMarketSnapshot(symbol))
      }))
    );

    const members = results.flatMap((result) => (result.status === "fulfilled" ? [result.value] : []));

    if (members.length < 2) {
      throw new Error(`Not enough market data for industry ${seed.symbol}`);
    }

    const recentSeries = this.aggregateIndustrySeries(members, "recentSeries");
    const longTermSeries = this.aggregateIndustrySeries(members, "longTermSeries");
    const intradaySeries = this.aggregateIndustrySeries(members, "intradaySeries");

    if (recentSeries.length < 20) {
      throw new Error(`Industry series too short for ${seed.symbol}`);
    }

    const currentPrice = this.computeIndustryCurrentValue(members, "recentSeries");
    const currentLongTermPrice = this.computeIndustryCurrentValue(members, "longTermSeries");
    const currentIntradayPrice = this.computeIndustryCurrentValue(members, "intradaySeries");
    const oneMonthBase = recentSeries.at(Math.max(0, recentSeries.length - 22))?.close ?? currentPrice;
    const threeMonthBase = recentSeries.at(0)?.close ?? currentPrice;
    const oneMonthReturn = oneMonthBase > 0 ? ((currentPrice - oneMonthBase) / oneMonthBase) * 100 : 0;
    const threeMonthReturn =
      threeMonthBase > 0 ? ((currentPrice - threeMonthBase) / threeMonthBase) * 100 : 0;
    const averageVolume =
      members.reduce((sum, member) => sum + member.averageVolume, 0) / Math.max(members.length, 1);

    return {
      symbol: seed.symbol,
      name: seed.name,
      nameKo: seed.nameKo,
      category: seed.category,
      descriptionKo: `${seed.descriptionKo}. 대표 종목: ${members.map((member) => member.symbol).join(", ")}`,
      currentPrice,
      metricLabel: `분야 지수 ${currentPrice.toFixed(1)}`,
      oneMonthReturn,
      threeMonthReturn,
      priceHistory: buildPriceHistory(recentSeries, currentPrice, oneMonthReturn, threeMonthReturn),
      extendedPriceHistory: buildExtendedPriceHistory(
        longTermSeries,
        currentLongTermPrice,
        oneMonthReturn,
        threeMonthReturn
      ),
      intradayPriceHistory: buildIntradayPriceHistory(intradaySeries, currentIntradayPrice),
      score: 0,
      notes: [
        formatReturnNote("한 달 전보다", oneMonthReturn),
        formatReturnNote("세 달 전보다", threeMonthReturn),
        `대표 종목 ${members.map((member) => member.symbol).join(", ")} 기준`
      ],
      averageVolume
    };
  }

  private async loadMarketSnapshot(symbol: string): Promise<SymbolMarketSnapshot> {
    const cached = this.marketSnapshotCache.get(symbol);

    if (cached) {
      return cached;
    }

    const pending = (async () => {
      const [quote, recentChart, longTermChart, intradayChart] = (await Promise.all([
        financeApi.quote(symbol),
        financeApi.chart(symbol, {
          period1: new Date(Date.now() - 95 * 24 * 60 * 60 * 1000),
          period2: new Date(Date.now() - 24 * 60 * 60 * 1000),
          interval: "1d"
        }),
        financeApi.chart(symbol, {
          period1: new Date(Date.now() - 1_150 * 24 * 60 * 60 * 1000),
          period2: new Date(Date.now() - 24 * 60 * 60 * 1000),
          interval: "1wk"
        }),
        financeApi.chart(symbol, {
          period1: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
          period2: new Date(),
          interval: "5m"
        })
      ])) as [
        any,
        { quotes?: Array<{ date?: Date | string; close?: number | null }> },
        { quotes?: Array<{ date?: Date | string; close?: number | null }> },
        { quotes?: Array<{ date?: Date | string; close?: number | null }> }
      ];

      const recentSeries = normalizeQuotes(recentChart.quotes ?? []);
      const longTermSeries = normalizeQuotes(longTermChart.quotes ?? []);
      const intradaySeries = normalizeIntradayQuotes(intradayChart.quotes ?? []);
      const fallbackPrice = recentSeries.at(-1)?.close ?? longTermSeries.at(-1)?.close ?? 0;
      const currentPrice =
        quote.regularMarketPrice ?? quote.postMarketPrice ?? quote.preMarketPrice ?? fallbackPrice;

      return {
        currentPrice,
        marketCap: Number(quote.marketCap ?? 0),
        averageVolume: Number(quote.averageDailyVolume3Month ?? quote.regularMarketVolume ?? 0),
        recentSeries,
        longTermSeries,
        intradaySeries
      };
    })();

    this.marketSnapshotCache.set(symbol, pending);
    return pending;
  }

  private async loadFundamentals(symbol: string): Promise<SymbolFundamentals> {
    const cached = this.fundamentalsCache.get(symbol);

    if (cached) {
      return cached;
    }

    const pending = (async () => {
      const summary = (await financeApi.quoteSummary(symbol, {
        modules: ["financialData", "summaryDetail"]
      })) as any;

      return {
        operatingMargin: Number(summary?.financialData?.operatingMargins ?? 0) * 100,
        returnOnEquity: Number(summary?.financialData?.returnOnEquity ?? 0) * 100,
        dividendYield: Number(summary?.summaryDetail?.dividendYield ?? 0) * 100
      };
    })();

    this.fundamentalsCache.set(symbol, pending);
    return pending;
  }

  private aggregateIndustrySeries(
    members: IndustryMemberSnapshot[],
    key: "recentSeries" | "longTermSeries" | "intradaySeries"
  ): NormalizedClosePoint[] {
    const byDate = new Map<string, { date: Date; values: number[] }>();

    for (const member of members) {
      const series = member[key];
      const basePrice = series[0]?.close;

      if (!basePrice || basePrice <= 0) {
        continue;
      }

      for (const point of series) {
        const normalizedClose = (point.close / basePrice) * 100;
        const keyDate = point.date.toISOString();
        const current = byDate.get(keyDate);

        if (current) {
          current.values.push(normalizedClose);
        } else {
          byDate.set(keyDate, { date: point.date, values: [normalizedClose] });
        }
      }
    }

    return [...byDate.values()]
      .sort((left, right) => left.date.getTime() - right.date.getTime())
      .map((entry) => ({
        date: entry.date,
        close:
          entry.values.reduce((sum, value) => sum + value, 0) / Math.max(entry.values.length, 1)
      }));
  }

  private computeIndustryCurrentValue(
    members: IndustryMemberSnapshot[],
    key: "recentSeries" | "longTermSeries" | "intradaySeries"
  ) {
    const values = members.flatMap((member) => {
      const basePrice = member[key][0]?.close;

      if (!basePrice || basePrice <= 0) {
        return [];
      }

      return [(member.currentPrice / basePrice) * 100];
    });

    if (values.length === 0) {
      return 100;
    }

    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }

  private scoreAndTrim(
    assets: EnrichedAsset[],
    mode: "bluechip" | "themes" | "sectors" | "industries"
  ): RankedAsset[] {
    const oneMonthValues = assets.map((asset) => asset.oneMonthReturn);
    const threeMonthValues = assets.map((asset) => asset.threeMonthReturn);
    const volumeValues = assets.map((asset) => asset.averageVolume ?? 0);
    const marketCapValues = assets.map((asset) => asset.marketCap ?? 0);
    const marginValues = assets.map((asset) => asset.operatingMargin ?? 0);
    const roeValues = assets.map((asset) => asset.returnOnEquity ?? 0);

    const scored = assets.map((asset) => {
      const trendScore =
        percentileScore(asset.oneMonthReturn, oneMonthValues) * 0.45 +
        percentileScore(asset.threeMonthReturn, threeMonthValues) * 0.3;

      let score = trendScore;

      if (mode === "bluechip") {
        score += percentileScore(asset.marketCap ?? 0, marketCapValues) * 0.15;
        score += percentileScore(asset.operatingMargin ?? 0, marginValues) * 0.05;
        score += percentileScore(asset.returnOnEquity ?? 0, roeValues) * 0.05;
      } else {
        score += percentileScore(asset.averageVolume ?? 0, volumeValues) * 0.25;
      }

      return {
        ...asset,
        score: Number((score * 100).toFixed(1))
      };
    });

    return scored
      .sort((left, right) => right.score - left.score)
      .slice(0, 10)
      .map(
        ({
          operatingMargin: _operatingMargin,
          returnOnEquity: _returnOnEquity,
          averageVolume: _averageVolume,
          dividendYield: _dividendYield,
          ...asset
        }) => asset
      );
  }
}
