import type { RankedAsset } from "@trade/shared";
import YahooFinance from "yahoo-finance2";
import type { AssetSeed } from "./market-universes.js";
import {
  BLUE_CHIP_UNIVERSE,
  SECTOR_UNIVERSE,
  TRENDING_THEME_UNIVERSE
} from "./market-universes.js";

const financeApi = new (YahooFinance as any)({
  suppressNotices: ["yahooSurvey", "ripHistorical"]
});

interface EnrichedAsset extends RankedAsset {
  operatingMargin?: number;
  returnOnEquity?: number;
  dividendYield?: number;
  averageVolume?: number;
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

export class MarketDataService {
  async getBlueChipLeaders(): Promise<RankedAsset[]> {
    const assets = await this.enrichUniverse(BLUE_CHIP_UNIVERSE, true);
    return this.scoreAndTrim(assets, "bluechip");
  }

  async getTrendingThemes(): Promise<RankedAsset[]> {
    const assets = await this.enrichUniverse(TRENDING_THEME_UNIVERSE, false);
    return this.scoreAndTrim(assets, "themes");
  }

  async getSectorLeaders(): Promise<RankedAsset[]> {
    const assets = await this.enrichUniverse(SECTOR_UNIVERSE, false);
    return this.scoreAndTrim(assets, "sectors");
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
    const [quote, chart, summary] = (await Promise.all([
      financeApi.quote(seed.symbol),
      financeApi.chart(seed.symbol, {
        period1: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000),
        period2: new Date(Date.now() - 24 * 60 * 60 * 1000),
        interval: "1d"
      }),
      withFundamentals
        ? financeApi.quoteSummary(seed.symbol, {
            modules: ["price", "financialData", "summaryDetail"]
          })
        : Promise.resolve(undefined)
    ])) as [any, { quotes?: Array<{ close?: number }> }, any];

    const closes = (chart.quotes ?? [])
      .map((item) => item.close)
      .filter((value): value is number => typeof value === "number" && Number.isFinite(value));

    const currentPrice =
      quote.regularMarketPrice ?? quote.postMarketPrice ?? quote.preMarketPrice ?? closes.at(-1) ?? 0;

    const oneMonthBase = closes.at(Math.max(0, closes.length - 22)) ?? currentPrice;
    const threeMonthBase = closes.at(0) ?? currentPrice;
    const oneMonthReturn = oneMonthBase > 0 ? ((currentPrice - oneMonthBase) / oneMonthBase) * 100 : 0;
    const threeMonthReturn =
      threeMonthBase > 0 ? ((currentPrice - threeMonthBase) / threeMonthBase) * 100 : 0;

    const marketCap = Number(summary?.price?.marketCap ?? quote.marketCap ?? 0);
    const operatingMargin = Number(summary?.financialData?.operatingMargins ?? 0) * 100;
    const returnOnEquity = Number(summary?.financialData?.returnOnEquity ?? 0) * 100;
    const dividendYield = Number(summary?.summaryDetail?.dividendYield ?? 0) * 100;
    const averageVolume = Number(quote.averageDailyVolume3Month ?? quote.regularMarketVolume ?? 0);

    const notes = [
      `1M ${formatPercent(oneMonthReturn)}`,
      `3M ${formatPercent(threeMonthReturn)}`,
      withFundamentals
        ? `마진 ${formatPercent(operatingMargin)} / ROE ${formatPercent(returnOnEquity)}`
        : `거래량 ${(averageVolume / 1_000_000).toFixed(1)}M`
    ];

    return {
      symbol: seed.symbol,
      name: seed.name,
      category: seed.category,
      currentPrice,
      marketCap,
      oneMonthReturn,
      threeMonthReturn,
      score: 0,
      notes,
      operatingMargin,
      returnOnEquity,
      dividendYield,
      averageVolume
    };
  }

  private scoreAndTrim(
    assets: EnrichedAsset[],
    mode: "bluechip" | "themes" | "sectors"
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
      .map(({ operatingMargin: _operatingMargin, returnOnEquity: _returnOnEquity, averageVolume: _averageVolume, dividendYield: _dividendYield, ...asset }) => asset);
  }
}
