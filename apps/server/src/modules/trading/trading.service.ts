import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import type {
  AutoSellEvent,
  AutoSellSettings,
  HoldingSnapshot,
  ManualOrderRequest,
  ManualOrderResponse,
  TradingStatus
} from "@trade/shared";
import { APP_ROOT, env } from "../../config/env.js";
import { KisClient } from "../../integrations/kis/kis-client.js";
import { JsonStore } from "../../lib/json-store.js";
import { logger } from "../../lib/logger.js";

interface TradingState {
  settings: AutoSellSettings;
  recentEvents: AutoSellEvent[];
}

const DEFAULT_SETTINGS: AutoSellSettings = {
  enabled: env.AUTO_SELL_ENABLED,
  targetProfitPercent: env.AUTO_SELL_TARGET_PERCENT,
  pollIntervalMs: env.AUTO_SELL_POLL_INTERVAL_MS,
  watchSymbols: []
};

export class TradingService {
  private readonly store = new JsonStore<TradingState>(
    resolve(APP_ROOT, "apps/server/data/trading-state.json"),
    {
      settings: DEFAULT_SETTINGS,
      recentEvents: []
    }
  );

  private settings = DEFAULT_SETTINGS;
  private recentEvents: AutoSellEvent[] = [];
  private holdings: HoldingSnapshot[] = [];
  private lastCheckedAt?: string;
  private lastError?: string;
  private timer?: NodeJS.Timeout;
  private runningCheck?: Promise<void>;

  constructor(private readonly kisClient: KisClient) {}

  async init() {
    const state = await this.store.read();
    this.settings = state.settings;
    this.recentEvents = state.recentEvents;
    this.applyTimer();
    await this.runCheck();
  }

  getStatus(): TradingStatus {
    return {
      settings: this.settings,
      monitorRunning: Boolean(this.timer),
      lastCheckedAt: this.lastCheckedAt,
      lastError: this.lastError,
      holdings: this.holdings,
      recentEvents: this.recentEvents
    };
  }

  async refreshNow(): Promise<TradingStatus> {
    await this.runCheck();
    return this.getStatus();
  }

  async updateSettings(nextSettings: Partial<AutoSellSettings>): Promise<TradingStatus> {
    this.settings = {
      ...this.settings,
      ...nextSettings,
      watchSymbols: (nextSettings.watchSymbols ?? this.settings.watchSymbols)
        .map((symbol) => symbol.trim().toUpperCase())
        .filter(Boolean)
    };

    await this.persist();
    this.applyTimer();
    await this.runCheck();
    return this.getStatus();
  }

  async submitManualOrder(input: ManualOrderRequest): Promise<ManualOrderResponse> {
    const result = await this.kisClient.placeOrder({
      symbol: input.symbol.toUpperCase(),
      exchange: input.exchange,
      quantity: input.quantity,
      limitPrice: input.limitPrice,
      side: input.side
    });

    const submittedAt = new Date().toISOString();

    this.pushEvent({
      id: randomUUID(),
      symbol: input.symbol.toUpperCase(),
      exchange: input.exchange,
      quantity: input.quantity,
      triggerProfitPercent: 0,
      targetProfitPercent: this.settings.targetProfitPercent,
      orderPrice: input.limitPrice,
      status: "submitted",
      reason: `수동 ${input.side === "buy" ? "매수" : "매도"} 주문 제출`,
      createdAt: submittedAt,
      orderNumber: result.ODNO
    });

    await this.persist();

    return {
      symbol: input.symbol.toUpperCase(),
      exchange: input.exchange,
      side: input.side,
      quantity: input.quantity,
      limitPrice: input.limitPrice,
      orderNumber: result.ODNO,
      submittedAt,
      message: `수동 ${input.side === "buy" ? "매수" : "매도"} 주문이 접수되었습니다.`
    };
  }

  private applyTimer() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }

    if (!this.settings.enabled) {
      return;
    }

    this.timer = setInterval(() => {
      void this.runCheck();
    }, this.settings.pollIntervalMs);
  }

  private async runCheck() {
    if (this.runningCheck) {
      return this.runningCheck;
    }

    this.runningCheck = this.executeCheck().finally(() => {
      this.runningCheck = undefined;
    });

    return this.runningCheck;
  }

  private async executeCheck() {
    try {
      if (!this.kisClient.isConfigured()) {
        this.holdings = [];
        this.lastError = "KIS API 키와 계좌 정보가 아직 설정되지 않았습니다.";
        this.lastCheckedAt = new Date().toISOString();
        return;
      }

      this.holdings = await this.kisClient.getUsHoldings();
      this.lastError = undefined;
      this.lastCheckedAt = new Date().toISOString();

      if (!this.settings.enabled) {
        return;
      }

      for (const holding of this.holdings) {
        if (!this.shouldMonitor(holding)) {
          continue;
        }

        if (holding.orderableQuantity <= 0) {
          continue;
        }

        if (holding.profitPercent < this.settings.targetProfitPercent) {
          continue;
        }

        if (this.hasRecentSubmittedOrder(holding.symbol)) {
          this.pushEvent({
            id: randomUUID(),
            symbol: holding.symbol,
            exchange: holding.exchange,
            quantity: holding.orderableQuantity,
            triggerProfitPercent: holding.profitPercent,
            targetProfitPercent: this.settings.targetProfitPercent,
            orderPrice: holding.currentPrice,
            status: "skipped",
            reason: "최근 동일 종목 매도 주문이 이미 접수되어 재주문을 건너뜀",
            createdAt: new Date().toISOString()
          });
          continue;
        }

        try {
          const result = await this.kisClient.sellHolding(holding);

          this.pushEvent({
            id: randomUUID(),
            symbol: holding.symbol,
            exchange: holding.exchange,
            quantity: holding.orderableQuantity,
            triggerProfitPercent: holding.profitPercent,
            targetProfitPercent: this.settings.targetProfitPercent,
            orderPrice: holding.currentPrice,
            status: "submitted",
            reason: "목표 수익률 도달로 지정가 매도 주문 제출",
            createdAt: new Date().toISOString(),
            orderNumber: result.ODNO
          });
        } catch (error) {
          this.pushEvent({
            id: randomUUID(),
            symbol: holding.symbol,
            exchange: holding.exchange,
            quantity: holding.orderableQuantity,
            triggerProfitPercent: holding.profitPercent,
            targetProfitPercent: this.settings.targetProfitPercent,
            orderPrice: holding.currentPrice,
            status: "failed",
            reason: error instanceof Error ? error.message : "알 수 없는 주문 오류",
            createdAt: new Date().toISOString()
          });
        }
      }
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : "자동매도 점검 중 오류가 발생했습니다.";
      logger.error("Trading monitor failed", error);
    } finally {
      await this.persist();
    }
  }

  private shouldMonitor(holding: HoldingSnapshot) {
    return (
      this.settings.watchSymbols.length === 0 ||
      this.settings.watchSymbols.includes(holding.symbol.toUpperCase())
    );
  }

  private hasRecentSubmittedOrder(symbol: string) {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    return this.recentEvents.some(
      (event) =>
        event.symbol === symbol &&
        event.status === "submitted" &&
        new Date(event.createdAt).getTime() > cutoff
    );
  }

  private pushEvent(event: AutoSellEvent) {
    this.recentEvents = [event, ...this.recentEvents].slice(0, 30);
  }

  private async persist() {
    await this.store.write({
      settings: this.settings,
      recentEvents: this.recentEvents
    });
  }
}
