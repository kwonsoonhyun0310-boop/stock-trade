import type { MarketDashboard } from "@trade/shared";
import { env } from "../../config/env.js";
import { CodexCliProvider } from "../../integrations/ai/codex-cli-provider.js";
import { logger } from "../../lib/logger.js";
import { MarketDataService } from "./market-data.service.js";

interface CacheEntry {
  expiresAt: number;
  value: MarketDashboard;
}

export class MarketAnalysisService {
  private cache?: CacheEntry;

  constructor(
    private readonly marketDataService: MarketDataService,
    private readonly codexCliProvider: CodexCliProvider
  ) {}

  async getDashboard(forceRefresh = false): Promise<MarketDashboard> {
    if (!forceRefresh && this.cache && this.cache.expiresAt > Date.now()) {
      return this.cache.value;
    }

    const [blueChips, trendingThemes, sectorLeaders] = await Promise.all([
      this.marketDataService.getBlueChipLeaders(),
      this.marketDataService.getTrendingThemes(),
      this.marketDataService.getSectorLeaders()
    ]);

    const baseDashboard = {
      generatedAt: new Date().toISOString(),
      blueChips,
      trendingThemes,
      sectorLeaders
    };

    let analysis;

    try {
      analysis = await this.codexCliProvider.analyzeMarket(baseDashboard);
    } catch (error) {
      logger.warn("Codex analysis failed, using fallback commentary", error);
      analysis = [
        {
          title: "우량주 구도",
          summary: "대형주는 시가총액과 최근 수익률이 동시에 유지되는 종목 중심으로 상단에 배치되었습니다.",
          bullets: [
            "상위 종목은 대체로 메가캡 기술주와 현금흐름이 강한 플랫폼 기업입니다.",
            "1개월과 3개월 모멘텀이 동시에 강한 종목이 우선순위를 높입니다."
          ],
          confidence: "medium" as const
        },
        {
          title: "현재 트렌드",
          summary: "테마 랭킹은 최근 1개월 수익률과 거래대금 집중도를 함께 반영합니다.",
          bullets: [
            "AI 반도체, 방산, 인프라 같은 자본지출 수혜 영역이 상대적으로 상단에 오를 가능성이 큽니다.",
            "단기 과열 구간에서는 변동성이 빠르게 확대될 수 있습니다."
          ],
          confidence: "medium" as const
        },
        {
          title: "섹터 체크포인트",
          summary: "섹터 상위권은 시장의 위험선호와 금리 민감도에 영향을 받습니다.",
          bullets: [
            "경기민감주가 올라오면 산업재와 금융 섹터가 동반 강세를 보일 수 있습니다.",
            "방어주 비중이 올라오면 시장이 변동성 방어 모드로 이동했을 가능성을 점검해야 합니다."
          ],
          confidence: "low" as const
        }
      ];
    }

    const dashboard: MarketDashboard = {
      ...baseDashboard,
      analysis
    };

    this.cache = {
      value: dashboard,
      expiresAt: Date.now() + env.MARKET_CACHE_TTL_MS
    };

    return dashboard;
  }
}
