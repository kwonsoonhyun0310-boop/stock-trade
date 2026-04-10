import { resolve } from "node:path";
import type { AnalysisSection, DailyAnalysisSnapshot, MarketDashboard, RankedAsset } from "@trade/shared";
import { APP_ROOT } from "../../config/env.js";
import { CodexCliProvider } from "../../integrations/ai/codex-cli-provider.js";
import { JsonStore } from "../../lib/json-store.js";
import { logger } from "../../lib/logger.js";
import { MarketDataService } from "./market-data.service.js";
import {
  buildFallbackExtendedPriceHistory,
  buildFallbackIntradayPriceHistory,
  buildFallbackPriceHistory
} from "./market-price-history.js";
import { hasFreshUsRegularMarketData } from "./market-session.js";
import { MARKET_ASSET_LOOKUP } from "./market-universes.js";

const MARKET_HISTORY_LIMIT = 30;
const MARKET_TIME_ZONE = "Asia/Seoul";

const dateKeyFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: MARKET_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
});

const getDateKey = (value: string | Date) => dateKeyFormatter.format(new Date(value));

const toHistorySnapshot = (generatedAt: string, sections: AnalysisSection[]): DailyAnalysisSnapshot => ({
  dateKey: getDateKey(generatedAt),
  generatedAt,
  sections
});

const simplifyAnalysisText = (text: string) =>
  text
    .replace(/\b1M\b/g, "한 달 전보다")
    .replace(/\b3M\b/g, "세 달 전보다")
    .replace(/1개월 수익률/g, "한 달 전보다 얼마나 달라졌는지")
    .replace(/3개월 수익률/g, "세 달 전보다 얼마나 달라졌는지")
    .replace(/1개월/g, "한 달")
    .replace(/3개월/g, "세 달")
    .replace(/거래량\s+(\d+(?:\.\d+)?)M/g, (_match, value: string) => {
      const numeric = Number(value);
      return Number.isFinite(numeric)
        ? `하루 평균 거래량 약 ${Math.round(numeric * 100)}만주`
        : _match;
    });

const simplifyRankedAsset = (asset: RankedAsset): RankedAsset => {
  const metadata = MARKET_ASSET_LOOKUP.get(asset.symbol);
  const nameKo = asset.nameKo || metadata?.nameKo || asset.name;

  return {
    ...asset,
    nameKo,
    descriptionKo:
      asset.descriptionKo || metadata?.descriptionKo || `${nameKo} 관련 대표 종목`,
    metricLabel: asset.metricLabel,
    priceHistory:
      Array.isArray(asset.priceHistory) && asset.priceHistory.length > 0
        ? asset.priceHistory
        : buildFallbackPriceHistory(asset.currentPrice, asset.oneMonthReturn, asset.threeMonthReturn),
    extendedPriceHistory:
      Array.isArray(asset.extendedPriceHistory) && asset.extendedPriceHistory.length > 0
        ? asset.extendedPriceHistory
        : buildFallbackExtendedPriceHistory(
            asset.currentPrice,
            asset.oneMonthReturn,
            asset.threeMonthReturn
          ),
    intradayPriceHistory:
      Array.isArray(asset.intradayPriceHistory) && asset.intradayPriceHistory.length > 0
        ? asset.intradayPriceHistory
        : buildFallbackIntradayPriceHistory(asset.currentPrice),
    notes: asset.notes.map((note) => simplifyAnalysisText(note))
  };
};

const hasDetailedPriceHistory = (asset: RankedAsset) =>
  Array.isArray(asset.priceHistory) &&
  asset.priceHistory.length >= 30 &&
  Array.isArray(asset.extendedPriceHistory) &&
  asset.extendedPriceHistory.length >= 40 &&
  Array.isArray(asset.intradayPriceHistory) &&
  asset.intradayPriceHistory.length >= 8;

  const hasDetailedDashboardHistory = (dashboard: MarketDashboard) =>
  dashboard.blueChips.length > 0 &&
  dashboard.trendingThemes.length > 0 &&
  dashboard.sectorLeaders.length > 0 &&
  dashboard.industryMomentumLeaders.length > 0 &&
  [
    ...dashboard.blueChips,
    ...dashboard.trendingThemes,
    ...dashboard.sectorLeaders,
    ...dashboard.industryMomentumLeaders
  ].every(
    hasDetailedPriceHistory
  );

const getAnalysisGeneratedAt = (dashboard: MarketDashboard) =>
  dashboard.analysisGeneratedAt || dashboard.analysisHistory[0]?.generatedAt || dashboard.generatedAt;

const simplifySections = (sections: AnalysisSection[]): AnalysisSection[] =>
  sections.map((section) => ({
    ...section,
    title: simplifyAnalysisText(section.title),
    summary: simplifyAnalysisText(section.summary),
    bullets: section.bullets.map((bullet) => simplifyAnalysisText(bullet))
  }));

const buildFallbackAnalysis = (): AnalysisSection[] => [
  {
    title: "시장 구조와 방향",
    summary:
      "지금 시장 구조는 강한 분야로만 돈이 먼저 모이는 선택형 구조이고, 전체적으로는 완만한 상향세로 볼 수 있습니다.",
    bullets: [
      "위에 있는 종목은 대체로 아주 큰 기술 회사나 돈을 잘 버는 플랫폼 회사입니다.",
      "한 달 전보다 흐름과 세 달 전보다 흐름이 같이 버티는 쪽에 돈이 몰리는 것이 이유입니다."
    ],
    confidence: "medium"
  },
  {
    title: "현재 트렌드",
    summary: "지금 인기 있는 분야 순위는 최근 흐름과 사람들이 얼마나 많이 사고파는지를 같이 봅니다.",
    bullets: [
      "AI 반도체, 방산, 인프라 같은 자본지출 수혜 영역이 상대적으로 상단에 오를 가능성이 큽니다.",
      "단기 과열 구간에서는 변동성이 빠르게 확대될 수 있습니다."
    ],
    confidence: "medium"
  },
  {
    title: "섹터 체크포인트",
    summary: "업종 순위는 시장 분위기와 금리 변화에 따라 달라질 수 있습니다.",
    bullets: [
      "경기민감주가 올라오면 산업재와 금융 섹터가 동반 강세를 보일 수 있습니다.",
      "방어주 비중이 올라오면 시장이 변동성 방어 모드로 이동했을 가능성을 점검해야 합니다."
    ],
    confidence: "low"
  }
];

const normalizeDashboard = (dashboard: MarketDashboard | null): MarketDashboard | null => {
  if (!dashboard) {
    return null;
  }

  const industryMomentumLeaders = Array.isArray(
    (dashboard as MarketDashboard & { industryMomentumLeaders?: RankedAsset[] }).industryMomentumLeaders
  )
    ? (dashboard as MarketDashboard & { industryMomentumLeaders?: RankedAsset[] }).industryMomentumLeaders!.map(
        simplifyRankedAsset
      )
    : [];

  if (Array.isArray(dashboard.analysisHistory) && dashboard.analysisHistory.length > 0) {
    return {
      ...dashboard,
      analysisGeneratedAt: getAnalysisGeneratedAt(dashboard),
      usdKrwRate: Number((dashboard as MarketDashboard & { usdKrwRate?: number }).usdKrwRate ?? 0),
      usdKrwUpdatedAt: (dashboard as MarketDashboard & { usdKrwUpdatedAt?: string }).usdKrwUpdatedAt,
      blueChips: dashboard.blueChips.map(simplifyRankedAsset),
      trendingThemes: dashboard.trendingThemes.map(simplifyRankedAsset),
      sectorLeaders: dashboard.sectorLeaders.map(simplifyRankedAsset),
      industryMomentumLeaders,
      analysis: simplifySections(dashboard.analysis),
      analysisHistory: dashboard.analysisHistory.map((entry) => ({
        ...entry,
        sections: simplifySections(entry.sections)
      }))
    };
  }

  return {
    ...dashboard,
    analysisGeneratedAt: getAnalysisGeneratedAt(dashboard),
    usdKrwRate: Number((dashboard as MarketDashboard & { usdKrwRate?: number }).usdKrwRate ?? 0),
    usdKrwUpdatedAt: (dashboard as MarketDashboard & { usdKrwUpdatedAt?: string }).usdKrwUpdatedAt,
    blueChips: dashboard.blueChips.map(simplifyRankedAsset),
    trendingThemes: dashboard.trendingThemes.map(simplifyRankedAsset),
    sectorLeaders: dashboard.sectorLeaders.map(simplifyRankedAsset),
    industryMomentumLeaders,
    analysis: simplifySections(dashboard.analysis),
    analysisHistory:
      dashboard.analysis.length > 0
        ? [toHistorySnapshot(dashboard.generatedAt, simplifySections(dashboard.analysis))]
        : []
  };
};

export class MarketAnalysisService {
  private readonly store = new JsonStore<MarketDashboard | null>(
    resolve(APP_ROOT, "apps/server/data/market-dashboard.json"),
    null
  );

  private cache: MarketDashboard | null = null;
  private loaded = false;
  private pendingDashboard?: Promise<MarketDashboard>;

  constructor(
    private readonly marketDataService: MarketDataService,
    private readonly codexCliProvider: CodexCliProvider
  ) {}

  async getDashboard(forceRefresh = false): Promise<MarketDashboard> {
    const todayKey = getDateKey(new Date());
    const cached = await this.loadCachedDashboard();

    if (
      !forceRefresh &&
      cached &&
      getDateKey(cached.generatedAt) === todayKey &&
      hasDetailedDashboardHistory(cached) &&
      cached.usdKrwRate > 0 &&
      hasFreshUsRegularMarketData(cached.generatedAt)
    ) {
      return cached;
    }

    if (this.pendingDashboard) {
      return this.pendingDashboard;
    }

    this.pendingDashboard = this.buildDashboard(cached).finally(() => {
      this.pendingDashboard = undefined;
    });

    return this.pendingDashboard;
  }

  private async buildDashboard(cached: MarketDashboard | null): Promise<MarketDashboard> {
    const [blueChips, trendingThemes, sectorLeaders, industryMomentumLeaders, usdKrwSnapshot] = await Promise.all([
      this.marketDataService.getBlueChipLeaders(),
      this.marketDataService.getTrendingThemes(),
      this.marketDataService.getSectorLeaders(),
      this.marketDataService.getIndustryMomentumLeaders(),
      this.marketDataService.getUsdKrwSnapshot()
    ]);

    const now = new Date().toISOString();
    const reuseCachedAnalysis =
      !!cached && getDateKey(getAnalysisGeneratedAt(cached)) === getDateKey(now) && cached.analysis.length > 0;
    const generatedAt = now;
    const analysisGeneratedAt = reuseCachedAnalysis ? getAnalysisGeneratedAt(cached!) : now;
    const baseDashboard = {
      generatedAt,
      analysisGeneratedAt,
      usdKrwRate: usdKrwSnapshot.usdKrwRate,
      usdKrwUpdatedAt: usdKrwSnapshot.updatedAt,
      blueChips,
      trendingThemes,
      sectorLeaders,
      industryMomentumLeaders
    };

    let analysis: AnalysisSection[];

    if (reuseCachedAnalysis) {
      analysis = simplifySections(cached!.analysis);
    } else {
      try {
        analysis = simplifySections(await this.codexCliProvider.analyzeMarket(baseDashboard));
      } catch (error) {
        logger.warn("Codex analysis failed, using fallback commentary", error);
        analysis = simplifySections(buildFallbackAnalysis());
      }
    }

    const latestSnapshot: DailyAnalysisSnapshot = {
      ...toHistorySnapshot(analysisGeneratedAt, analysis)
    };

    const history = reuseCachedAnalysis
      ? cached!.analysisHistory.length > 0
        ? cached!.analysisHistory
        : [latestSnapshot]
      : this.mergeHistory(cached?.analysisHistory ?? [], latestSnapshot);
    const dashboard: MarketDashboard = {
      ...baseDashboard,
      analysis,
      analysisHistory: history
    };

    this.cache = dashboard;
    await this.store.write(dashboard);
    return dashboard;
  }

  private mergeHistory(
    history: DailyAnalysisSnapshot[],
    latestSnapshot: DailyAnalysisSnapshot
  ): DailyAnalysisSnapshot[] {
    return [latestSnapshot, ...history.filter((entry) => entry.dateKey !== latestSnapshot.dateKey)].slice(
      0,
      MARKET_HISTORY_LIMIT
    );
  }

  private async loadCachedDashboard(): Promise<MarketDashboard | null> {
    if (this.loaded) {
      return this.cache;
    }

    this.loaded = true;
    this.cache = normalizeDashboard(await this.store.read());
    return this.cache;
  }
}
