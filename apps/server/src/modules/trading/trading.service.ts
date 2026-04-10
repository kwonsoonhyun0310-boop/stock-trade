import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import type {
  AccountSummary,
  AutoSellEvent,
  AutoSellSettings,
  AutoSellTarget,
  HoldingSnapshot,
  OneClickBuyPrecheckResponse,
  OneClickBuyRequest,
  OneClickBuyResponse,
  ProfitLedgerEntry,
  TradingStatus
} from "@trade/shared";
import { APP_ROOT, env } from "../../config/env.js";
import { KisClient } from "../../integrations/kis/kis-client.js";
import { JsonStore } from "../../lib/json-store.js";
import { logger } from "../../lib/logger.js";
import { getUsRegularMarketState } from "../market/market-session.js";
import {
  resolveBuyOrderSyncSnapshot,
  resolveSellOrderCompletionSnapshot
} from "./order-sync.js";
import {
  createProfitLedgerEntryFromEvent as createLedgerEntryFromEvent,
  dedupeProfitLedgerEntries as dedupeLedgerEntries,
  summarizeProfitLedger as summarizeLedger
} from "./profit-ledger.js";
import { buildHistoricalProfitLedgerEntries } from "./profit-ledger-import.js";

interface TradingState {
  settings: AutoSellSettings;
  recentEvents: AutoSellEvent[];
  autoSellTargets: AutoSellTarget[];
}

interface ProfitLedgerState {
  entries: ProfitLedgerEntry[];
  historyImportedAt?: string;
}

const DEFAULT_SETTINGS: AutoSellSettings = {
  enabled: true,
  targetProfitPercent: env.AUTO_SELL_TARGET_PERCENT,
  pollIntervalMs: env.AUTO_SELL_POLL_INTERVAL_MS,
  watchSymbols: []
};

const normalizeSettings = (settings?: Partial<AutoSellSettings>): AutoSellSettings => ({
  ...DEFAULT_SETTINGS,
  ...settings,
  enabled: true,
  watchSymbols: (settings?.watchSymbols ?? []).map((symbol) => symbol.trim().toUpperCase()).filter(Boolean)
});

const holdingKey = (symbol: string, exchange: string) => `${exchange}:${symbol.toUpperCase()}`;

const toRoundedPrice = (value: number) => Number(value.toFixed(2));

const calculateProfitPercent = (entryPrice: number, currentPrice: number) => {
  if (entryPrice <= 0 || currentPrice <= 0) {
    return 0;
  }

  return ((currentPrice - entryPrice) / entryPrice) * 100;
};

const emptyAccountSummary = (): AccountSummary => ({
  heldSymbolCount: 0,
  totalHoldingQuantity: 0,
  orderableCashUsd: 0,
  currency: "USD"
});

const normalizeTarget = (target: AutoSellTarget): AutoSellTarget => ({
  ...target,
  remainingQuantity: Number.isFinite(target.remainingQuantity)
    ? target.remainingQuantity
    : target.requestedQuantity,
  buyOrderStatus: target.buyOrderStatus ?? (target.buyOrderNumber ? "submitted" : "unknown"),
  buyFilledQuantity: Number.isFinite(target.buyFilledQuantity) ? target.buyFilledQuantity : 0,
  buyOpenQuantity: Number.isFinite(target.buyOpenQuantity)
    ? target.buyOpenQuantity
    : Math.max(0, target.requestedQuantity),
  buyOrderUpdatedAt: target.buyOrderUpdatedAt
});

const targetStatusRank: Record<AutoSellTarget["status"], number> = {
  armed: 0,
  cancelled: 1,
  completed: 2
};

const HISTORY_IMPORT_LOOKBACK_DAYS = 1_095;
const HISTORY_IMPORT_WINDOW_DAYS = 90;
const HISTORY_IMPORT_INTERVAL_MS = 24 * 60 * 60 * 1000;

interface CheckOptions {
  includeAccountDetails?: boolean;
  includeOrderSync?: boolean;
  ignoreCooldown?: boolean;
}

const RATE_LIMIT_COOLDOWN_MS = 20 * 1000;

const isRateLimitError = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /초당|초가|횟수|EGW001|rate/i.test(message);
};

export class TradingService {
  private readonly store = new JsonStore<TradingState>(
    resolve(APP_ROOT, "apps/server/data/trading-state.json"),
    {
      settings: DEFAULT_SETTINGS,
      recentEvents: [],
      autoSellTargets: []
    }
  );
  private readonly profitLedgerStore = new JsonStore<ProfitLedgerState>(
    resolve(APP_ROOT, "apps/server/data/profit-ledger.json"),
    {
      entries: []
    }
  );

  private settings = DEFAULT_SETTINGS;
  private recentEvents: AutoSellEvent[] = [];
  private autoSellTargets: AutoSellTarget[] = [];
  private profitLedgerEntries: ProfitLedgerEntry[] = [];
  private historyImportedAt?: string;
  private holdings: HoldingSnapshot[] = [];
  private accountSummary: AccountSummary = emptyAccountSummary();
  private lastCheckedAt?: string;
  private lastError?: string;
  private autoCheckCooldownUntil?: number;
  private timer?: NodeJS.Timeout;
  private runningCheck?: Promise<void>;

  constructor(private readonly kisClient: KisClient) {}

  async init() {
    const [state, profitLedgerState] = await Promise.all([
      this.store.read(),
      this.profitLedgerStore.read()
    ]);
    const previousEnabled = state.settings?.enabled;
    this.settings = normalizeSettings(state.settings);
    this.recentEvents = Array.isArray(state.recentEvents) ? state.recentEvents : [];
    this.autoSellTargets = Array.isArray(state.autoSellTargets)
      ? state.autoSellTargets.map(normalizeTarget)
      : [];
    const backfilledLedgerEntries = this.recentEvents
      .map((event) => createLedgerEntryFromEvent(event))
      .filter((entry): entry is ProfitLedgerEntry => Boolean(entry));
    this.profitLedgerEntries = Array.isArray(profitLedgerState.entries)
      ? dedupeLedgerEntries([...backfilledLedgerEntries, ...profitLedgerState.entries])
      : dedupeLedgerEntries(backfilledLedgerEntries);
    this.historyImportedAt = profitLedgerState.historyImportedAt;
    this.applyTimer();
    if (previousEnabled !== this.settings.enabled) {
      await this.persist();
    }
    await this.runCheck({ includeAccountDetails: true, includeOrderSync: true });
  }

  getStatus(): TradingStatus {
    return {
      settings: this.settings,
      monitorRunning: Boolean(this.timer),
      lastCheckedAt: this.lastCheckedAt,
      lastError: this.lastError,
      holdings: this.holdings,
      accountSummary: this.accountSummary,
      autoSellTargets: [...this.autoSellTargets].sort((left, right) => {
        if (left.status !== right.status) {
          return targetStatusRank[left.status] - targetStatusRank[right.status];
        }

        return right.createdAt.localeCompare(left.createdAt);
      }),
      recentEvents: this.recentEvents,
      profitLedger: summarizeLedger(this.profitLedgerEntries, this.lastCheckedAt ?? new Date().toISOString())
    };
  }

  async refreshNow(): Promise<TradingStatus> {
    await this.runCheck({ includeAccountDetails: true, includeOrderSync: true, ignoreCooldown: true });
    return this.getStatus();
  }

  async backfillProfitLedgerHistory(force = true): Promise<TradingStatus> {
    await this.maybeBackfillProfitLedgerHistory(force);
    return this.getStatus();
  }

  async updateSettings(nextSettings: Partial<AutoSellSettings>): Promise<TradingStatus> {
    this.settings = normalizeSettings({
      ...this.settings,
      ...nextSettings
    });

    await this.persist();
    this.applyTimer();
    await this.runCheck();
    return this.getStatus();
  }

  async precheckOneClickBuy(input: OneClickBuyRequest): Promise<OneClickBuyPrecheckResponse> {
    const quantity = Math.floor(input.quantity);
    const limitPrice = toRoundedPrice(input.limitPrice);
    const estimatedOrderValueUsd = toRoundedPrice(quantity * limitPrice);
    const checkedAt = new Date().toISOString();
    const checks: OneClickBuyPrecheckResponse["checks"] = [];
    let orderableCashUsd = 0;

    const marketState = getUsRegularMarketState(checkedAt);
    checks.push({
      code: "market_session",
      status: marketState.isRegularOpen ? "pass" : "warn",
      title: marketState.isRegularOpen ? "미국 정규장 진행 중" : "미국 정규장 외 시간",
      detail: marketState.isRegularOpen
        ? "지금은 미국 정규장 시간이라 현재 앱 주문 흐름과 잘 맞습니다."
        : "현재는 미국 정규장 시간이 아니라 주문이 지연되거나 거절될 수 있습니다."
    });

    if (!this.kisClient.isConfigured()) {
      checks.push({
        code: "kis_connection",
        status: "fail",
        title: "한국투자증권 설정 필요",
        detail: "KIS API 키와 계좌 정보가 아직 설정되지 않았습니다."
      });

      return {
        ready: false,
        checkedAt,
        estimatedOrderValueUsd,
        orderableCashUsd,
        checks
      };
    }

    try {
      orderableCashUsd = await this.kisClient.getOrderableCashUsd();
      checks.push({
        code: "kis_connection",
        status: "pass",
        title: "한국투자증권 계좌 응답 정상",
        detail: "해외주식 주문 전 계좌 응답을 정상적으로 확인했습니다."
      });
    } catch (error) {
      checks.push({
        code: "kis_connection",
        status: "fail",
        title: "한국투자증권 사전 응답 실패",
        detail: error instanceof Error ? error.message : "알 수 없는 계좌 조회 오류"
      });

      return {
        ready: false,
        checkedAt,
        estimatedOrderValueUsd,
        orderableCashUsd,
        checks
      };
    }

    checks.push({
      code: "orderable_cash",
      status: estimatedOrderValueUsd <= orderableCashUsd ? "pass" : "fail",
      title:
        estimatedOrderValueUsd <= orderableCashUsd
          ? "주문 가능 현금 확인"
          : "주문 가능 현금 부족",
      detail:
        estimatedOrderValueUsd <= orderableCashUsd
          ? `예상 주문금액 ${estimatedOrderValueUsd.toFixed(2)} USD, 주문 가능 현금 ${orderableCashUsd.toFixed(2)} USD`
          : `예상 주문금액 ${estimatedOrderValueUsd.toFixed(2)} USD가 주문 가능 현금 ${orderableCashUsd.toFixed(2)} USD보다 큽니다.`
    });

    return {
      ready: checks.every((check) => check.status !== "fail"),
      checkedAt,
      estimatedOrderValueUsd,
      orderableCashUsd,
      checks
    };
  }

  async submitOneClickBuy(input: OneClickBuyRequest): Promise<OneClickBuyResponse> {
    const symbol = input.symbol.trim().toUpperCase();
    const quantity = Math.floor(input.quantity);
    const limitPrice = toRoundedPrice(input.limitPrice);
    const result = await this.kisClient.placeOrder({
      symbol,
      exchange: input.exchange,
      quantity,
      limitPrice,
      side: "buy"
    });

    const submittedAt = new Date().toISOString();
    const targetProfitPercent = this.settings.targetProfitPercent;
    const targetPrice = toRoundedPrice(limitPrice * (1 + targetProfitPercent / 100));

    const target: AutoSellTarget = {
      id: randomUUID(),
      symbol,
      exchange: input.exchange,
      requestedQuantity: quantity,
      remainingQuantity: quantity,
      entryPrice: limitPrice,
      targetPrice,
      targetProfitPercent,
      status: "armed",
      buyOrderStatus: "submitted",
      buyFilledQuantity: 0,
      buyOpenQuantity: quantity,
      createdAt: submittedAt,
      buyOrderNumber: result.ODNO,
      buyOrderUpdatedAt: submittedAt
    };

    this.autoSellTargets = [target, ...this.autoSellTargets].slice(0, 100);

    if (!this.settings.enabled) {
      this.settings = {
        ...this.settings,
        enabled: true
      };
      this.applyTimer();
    }

    this.pushEvent({
      id: randomUUID(),
      symbol,
      exchange: input.exchange,
      quantity,
      entryPrice: limitPrice,
      triggerProfitPercent: 0,
      targetProfitPercent,
      orderPrice: limitPrice,
      status: "submitted",
      reason: `원클릭 매수 주문 제출, ${targetProfitPercent.toFixed(2)}% 자동매도 등록`,
      createdAt: submittedAt,
      orderNumber: result.ODNO
    });

    await this.persist();

    return {
      targetId: target.id,
      symbol,
      exchange: input.exchange,
      quantity,
      limitPrice,
      targetProfitPercent,
      targetPrice,
      orderNumber: result.ODNO,
      submittedAt,
      message: "원클릭 매수 주문이 접수되었고 자동매도 추적이 시작되었습니다."
    };
  }

  async cancelAutoSellTarget(targetId: string): Promise<TradingStatus> {
    const target = this.autoSellTargets.find((entry) => entry.id === targetId);

    if (!target) {
      throw new Error("자동매도 대상이 존재하지 않습니다.");
    }

    if (target.status !== "armed") {
      return this.getStatus();
    }

    const cancelledAt = new Date().toISOString();
    this.autoSellTargets = this.autoSellTargets.map((entry) =>
      entry.id === targetId
        ? {
            ...entry,
            status: "cancelled",
            cancelledAt
          }
        : entry
    );

    this.pushEvent({
      id: randomUUID(),
      symbol: target.symbol,
      exchange: target.exchange,
      quantity: target.remainingQuantity,
      entryPrice: target.entryPrice,
      triggerProfitPercent: 0,
      targetProfitPercent: target.targetProfitPercent,
      orderPrice: target.entryPrice,
      status: "cancelled",
      reason: "사용자가 자동매도 추적을 취소함",
      createdAt: cancelledAt
    });

    await this.persist();
    return this.getStatus();
  }

  async modifyBuyOrder(targetId: string, nextLimitPrice: number): Promise<TradingStatus> {
    const target = this.autoSellTargets.find((entry) => entry.id === targetId);

    if (!target) {
      throw new Error("자동매도 대상이 존재하지 않습니다.");
    }

    if (target.status !== "armed" || !target.buyOrderNumber) {
      throw new Error("수정 가능한 매수 주문이 없습니다.");
    }

    const limitPrice = toRoundedPrice(nextLimitPrice);

    if (limitPrice <= 0) {
      throw new Error("새 매수가는 0보다 커야 합니다.");
    }

    const result = await this.kisClient.reviseOrCancelOrder({
      symbol: target.symbol,
      exchange: target.exchange,
      originalOrderNumber: target.buyOrderNumber,
      quantity: Math.floor(target.buyOpenQuantity > 0 ? target.buyOpenQuantity : target.requestedQuantity),
      limitPrice,
      action: "modify"
    });

    const updatedAt = new Date().toISOString();
    this.autoSellTargets = this.autoSellTargets.map((entry) =>
      entry.id === targetId
        ? {
            ...entry,
            entryPrice: limitPrice,
            targetPrice: toRoundedPrice(limitPrice * (1 + entry.targetProfitPercent / 100)),
            buyOrderNumber: result.ODNO || entry.buyOrderNumber,
            buyOrderStatus: "submitted",
            buyOrderUpdatedAt: updatedAt
          }
        : entry
    );

    this.pushEvent({
      id: randomUUID(),
      symbol: target.symbol,
      exchange: target.exchange,
      quantity: target.requestedQuantity,
      entryPrice: limitPrice,
      triggerProfitPercent: 0,
      targetProfitPercent: target.targetProfitPercent,
      orderPrice: limitPrice,
      status: "submitted",
      reason: `사용자가 매수 주문 가격을 ${limitPrice.toFixed(2)} USD로 정정함`,
      createdAt: updatedAt,
      orderNumber: result.ODNO
    });

    await this.persist();
    return this.getStatus();
  }

  async cancelBuyOrder(targetId: string): Promise<TradingStatus> {
    const target = this.autoSellTargets.find((entry) => entry.id === targetId);

    if (!target) {
      throw new Error("자동매도 대상이 존재하지 않습니다.");
    }

    if (target.status !== "armed" || !target.buyOrderNumber) {
      throw new Error("취소 가능한 매수 주문이 없습니다.");
    }

    const result = await this.kisClient.reviseOrCancelOrder({
      symbol: target.symbol,
      exchange: target.exchange,
      originalOrderNumber: target.buyOrderNumber,
      quantity: Math.floor(target.buyOpenQuantity > 0 ? target.buyOpenQuantity : target.requestedQuantity),
      action: "cancel"
    });

    const cancelledAt = new Date().toISOString();
    this.autoSellTargets = this.autoSellTargets.map((entry) =>
      entry.id === targetId
        ? {
            ...entry,
            buyOrderStatus: "cancelled",
            buyOpenQuantity: 0,
            buyOrderUpdatedAt: cancelledAt
          }
        : entry
    );

    this.pushEvent({
      id: randomUUID(),
      symbol: target.symbol,
      exchange: target.exchange,
      quantity: target.requestedQuantity,
      entryPrice: target.entryPrice,
      triggerProfitPercent: 0,
      targetProfitPercent: target.targetProfitPercent,
      orderPrice: target.entryPrice,
      status: "cancelled",
      reason: "사용자가 원클릭 매수 주문을 취소함",
      createdAt: cancelledAt,
      orderNumber: result.ODNO
    });

    await this.persist();
    return this.getStatus();
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

  private async runCheck(options: CheckOptions = {}) {
    const nextOptions = {
      includeAccountDetails: options.includeAccountDetails ?? false,
      includeOrderSync: options.includeOrderSync ?? false,
      ignoreCooldown: options.ignoreCooldown ?? false
    };

    const activeTargetCount = this.autoSellTargets.filter(
      (target) => target.status === "armed" && target.remainingQuantity > 0
    ).length;
    const shouldSkipAutomaticCheck =
      !nextOptions.includeAccountDetails &&
      !nextOptions.includeOrderSync &&
      activeTargetCount === 0;

    if (shouldSkipAutomaticCheck) {
      this.lastCheckedAt = new Date().toISOString();
      return;
    }

    if (
      !nextOptions.ignoreCooldown &&
      this.autoCheckCooldownUntil &&
      Date.now() < this.autoCheckCooldownUntil
    ) {
      return;
    }

    if (this.runningCheck) {
      await this.runningCheck;

      if (!nextOptions.includeAccountDetails && !nextOptions.includeOrderSync) {
        return;
      }
    }

    this.runningCheck = this.executeCheck(nextOptions).finally(() => {
      this.runningCheck = undefined;
    });

    return this.runningCheck;
  }

  private async executeCheck(options: CheckOptions) {
    try {
      if (!this.kisClient.isConfigured()) {
        this.holdings = [];
        this.accountSummary = emptyAccountSummary();
        this.lastError = "KIS API 키와 계좌 정보가 아직 설정되지 않았습니다.";
        this.lastCheckedAt = new Date().toISOString();
        return;
      }

      const checkedAt = new Date().toISOString();
      this.holdings = await this.kisClient.getUsHoldings();
      this.accountSummary = {
        heldSymbolCount: this.holdings.length,
        totalHoldingQuantity: this.holdings.reduce((sum, holding) => sum + holding.quantity, 0),
        orderableCashUsd: this.accountSummary.orderableCashUsd,
        currency: "USD",
        updatedAt: this.accountSummary.updatedAt
      };

      if (options.includeAccountDetails) {
        try {
          const orderableCashUsd = await this.kisClient.getOrderableCashUsd();
          this.accountSummary = {
            ...this.accountSummary,
            orderableCashUsd,
            updatedAt: checkedAt
          };
        } catch (error) {
          logger.warn("Orderable cash refresh skipped", error);
        }
      }

      this.lastError = undefined;
      this.autoCheckCooldownUntil = undefined;
      this.lastCheckedAt = checkedAt;

      if (options.includeOrderSync) {
        try {
          await this.syncTrackedOrders();
        } catch (error) {
          logger.warn("Tracked order sync skipped", error);
        }
      }

      if (!this.settings.enabled) {
        return;
      }

      const activeTargets = this.autoSellTargets.filter(
        (target) => target.status === "armed" && target.remainingQuantity > 0
      );

      if (activeTargets.length === 0) {
        return;
      }

      const holdingsByKey = new Map(
        this.holdings.map((holding) => [holdingKey(holding.symbol, holding.exchange), holding])
      );
      const availableQuantities = new Map(
        this.holdings.map((holding) => [
          holdingKey(holding.symbol, holding.exchange),
          Math.floor(holding.orderableQuantity)
        ])
      );

      for (const target of activeTargets) {
        const key = holdingKey(target.symbol, target.exchange);
        const holding = holdingsByKey.get(key);

        if (!holding) {
          continue;
        }

        if (holding.currentPrice < target.targetPrice) {
          continue;
        }

        const availableQuantity = Math.min(
          Math.floor(target.remainingQuantity),
          availableQuantities.get(key) ?? 0
        );

        if (availableQuantity <= 0) {
          continue;
        }

        const triggerProfitPercent = calculateProfitPercent(target.entryPrice, holding.currentPrice);

        try {
          const result = await this.kisClient.placeOrder({
            symbol: target.symbol,
            exchange: target.exchange,
            quantity: availableQuantity,
            limitPrice: holding.currentPrice,
            side: "sell"
          });

          this.consumeTargetQuantity(target.id, availableQuantity);
          availableQuantities.set(key, Math.max(0, (availableQuantities.get(key) ?? 0) - availableQuantity));

          this.pushEvent({
            id: randomUUID(),
            symbol: target.symbol,
            exchange: target.exchange,
            quantity: availableQuantity,
            entryPrice: target.entryPrice,
            triggerProfitPercent,
            targetProfitPercent: target.targetProfitPercent,
            orderPrice: holding.currentPrice,
            status: "submitted",
            reason: "원클릭 매수로 등록된 수량이 목표 수익률에 도달해 자동매도 주문 제출",
            createdAt: new Date().toISOString(),
            orderNumber: result.ODNO
          });
        } catch (error) {
          this.pushEvent({
            id: randomUUID(),
            symbol: target.symbol,
            exchange: target.exchange,
            quantity: availableQuantity,
            entryPrice: target.entryPrice,
            triggerProfitPercent,
            targetProfitPercent: target.targetProfitPercent,
            orderPrice: holding.currentPrice,
            status: "failed",
            reason: error instanceof Error ? error.message : "알 수 없는 주문 오류",
            createdAt: new Date().toISOString()
          });
        }
      }
    } catch (error) {
      if (isRateLimitError(error) && !options.ignoreCooldown) {
        const retryAt = Date.now() + RATE_LIMIT_COOLDOWN_MS;
        this.autoCheckCooldownUntil = retryAt;
        this.lastError = `한국투자증권 조회 제한으로 잠시 쉬는 중입니다. ${new Date(retryAt).toLocaleTimeString("ko-KR")}에 자동매도 확인을 다시 시도합니다.`;
      } else {
        this.lastError = error instanceof Error ? error.message : "자동매도 점검 중 오류가 발생했습니다.";
      }
      logger.error("Trading monitor failed", error);
    } finally {
      await this.persist();
    }
  }

  private async maybeBackfillProfitLedgerHistory(force = false) {
    if (!this.kisClient.isConfigured()) {
      return;
    }

    const lastImportedAt = this.historyImportedAt ? new Date(this.historyImportedAt).getTime() : 0;
    const importDue = !lastImportedAt || Date.now() - lastImportedAt >= HISTORY_IMPORT_INTERVAL_MS;

    if (!force && !importDue) {
      return;
    }

    try {
      const historicalRows = await this.kisClient.getUsOrderHistoryWindows(
        HISTORY_IMPORT_LOOKBACK_DAYS,
        HISTORY_IMPORT_WINDOW_DAYS
      );
      const historicalEntries = buildHistoricalProfitLedgerEntries(historicalRows);
      this.profitLedgerEntries = dedupeLedgerEntries([...historicalEntries, ...this.profitLedgerEntries]).slice(0, 5_000);
      this.historyImportedAt = new Date().toISOString();
      await this.persist();
    } catch (error) {
      logger.error("Profit ledger history import failed", error);
    }
  }

  private consumeTargetQuantity(targetId: string, quantity: number) {
    const completedAt = new Date().toISOString();

    this.autoSellTargets = this.autoSellTargets.map((target) => {
      if (target.id !== targetId) {
        return target;
      }

      const remainingQuantity = Math.max(0, target.remainingQuantity - quantity);
      return {
        ...target,
        remainingQuantity,
        status: remainingQuantity > 0 ? "armed" : "completed",
        completedAt: remainingQuantity > 0 ? target.completedAt : completedAt
      };
    });
  }

  private async syncTrackedOrders() {
    const trackedBuyTargets = this.autoSellTargets.filter((target) => Boolean(target.buyOrderNumber));
    const submittedAutoSellEvents = this.recentEvents.filter(
      (event) =>
        event.status === "submitted" &&
        Boolean(event.orderNumber) &&
        event.reason.includes("자동매도 주문")
    );

    if (trackedBuyTargets.length === 0 && submittedAutoSellEvents.length === 0) {
      return;
    }

    const openOrders = await this.kisClient.getUsOpenOrders();
    const orderHistory = await this.kisClient.getUsOrderHistory();
    const syncTimestamp = new Date().toISOString();
    const pendingEvents: AutoSellEvent[] = [];

    this.autoSellTargets = this.autoSellTargets.map((target) => {
      const snapshot = resolveBuyOrderSyncSnapshot(target, openOrders, orderHistory);

      if (!snapshot) {
        return target;
      }

      const soldQuantity = Math.max(0, target.requestedQuantity - target.remainingQuantity);
      const nextTargetBase: AutoSellTarget = {
        ...target,
        buyOrderStatus: snapshot.status,
        buyFilledQuantity: snapshot.filledQuantity,
        buyOpenQuantity: snapshot.openQuantity,
        buyOrderUpdatedAt: syncTimestamp
      };

      if (
        target.buyOrderNumber &&
        snapshot.status === "filled" &&
        target.buyOrderStatus !== "filled" &&
        !this.hasRecentOrderEvent(target.buyOrderNumber, "completed")
      ) {
        pendingEvents.push({
          id: randomUUID(),
          symbol: target.symbol,
          exchange: target.exchange,
          quantity: snapshot.filledQuantity,
          entryPrice: target.entryPrice,
          triggerProfitPercent: 0,
          targetProfitPercent: target.targetProfitPercent,
          orderPrice: target.entryPrice,
          status: "completed",
          reason: `원클릭 매수 주문이 전량 체결되어 ${snapshot.filledQuantity.toFixed(0)}주 자동매도 추적이 유지됩니다.`,
          createdAt: syncTimestamp,
          orderNumber: target.buyOrderNumber
        });
      }

      if (
        target.buyOrderNumber &&
        snapshot.status === "rejected" &&
        target.buyOrderStatus !== "rejected" &&
        !this.hasRecentOrderEvent(target.buyOrderNumber, "failed")
      ) {
        pendingEvents.push({
          id: randomUUID(),
          symbol: target.symbol,
          exchange: target.exchange,
          quantity: target.requestedQuantity,
          entryPrice: target.entryPrice,
          triggerProfitPercent: 0,
          targetProfitPercent: target.targetProfitPercent,
          orderPrice: target.entryPrice,
          status: "failed",
          reason: "원클릭 매수 주문이 거래소 또는 증권사에서 거부되었습니다.",
          createdAt: syncTimestamp,
          orderNumber: target.buyOrderNumber
        });
      }

      if (snapshot.status !== "cancelled" && snapshot.status !== "rejected") {
        return nextTargetBase;
      }

      const clampedRemainingQuantity = Math.max(0, snapshot.filledQuantity - soldQuantity);
      const shouldKeepTracking =
        target.status === "completed" ||
        target.status === "cancelled" ||
        clampedRemainingQuantity > 0;

      return {
        ...nextTargetBase,
        remainingQuantity: clampedRemainingQuantity,
        status:
          target.status === "completed"
            ? "completed"
            : shouldKeepTracking
              ? target.status
              : "cancelled",
        cancelledAt:
          target.status === "cancelled" || clampedRemainingQuantity > 0
            ? target.cancelledAt
            : target.cancelledAt ?? syncTimestamp
      };
    });

    for (const event of submittedAutoSellEvents) {
      const completion = resolveSellOrderCompletionSnapshot(event, orderHistory);

      if (!completion || this.hasRecentOrderEvent(completion.orderNumber, "completed")) {
        continue;
      }

      pendingEvents.push({
        id: randomUUID(),
        symbol: completion.symbol,
        exchange: completion.exchange,
        quantity: completion.quantity,
        entryPrice: event.entryPrice,
        triggerProfitPercent: event.triggerProfitPercent,
        targetProfitPercent: event.targetProfitPercent,
        orderPrice: completion.orderPrice,
        status: "completed",
        reason: "자동매도 주문이 전량 체결되었습니다.",
        createdAt: syncTimestamp,
        orderNumber: completion.orderNumber
      });
    }

    for (const event of pendingEvents) {
      this.pushEvent(event);
    }
  }

  private hasRecentOrderEvent(orderNumber: string, status: AutoSellEvent["status"]) {
    return this.recentEvents.some(
      (event) => event.orderNumber === orderNumber && event.status === status
    );
  }

  private pushEvent(event: AutoSellEvent) {
    this.recentEvents = [event, ...this.recentEvents].slice(0, 30);
    const ledgerEntry = createLedgerEntryFromEvent(event);

    if (!ledgerEntry) {
      return;
    }

    this.profitLedgerEntries = dedupeLedgerEntries([ledgerEntry, ...this.profitLedgerEntries]).slice(0, 2_000);
  }

  private async persist() {
    await Promise.all([
      this.store.write({
        settings: this.settings,
        recentEvents: this.recentEvents,
        autoSellTargets: this.autoSellTargets
      }),
      this.profitLedgerStore.write({
        entries: this.profitLedgerEntries,
        historyImportedAt: this.historyImportedAt
      })
    ]);
  }
}
