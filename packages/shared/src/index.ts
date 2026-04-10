export type ExchangeCode = "NASD" | "NYSE" | "AMEX";

export interface AutoSellSettings {
  enabled: boolean;
  targetProfitPercent: number;
  pollIntervalMs: number;
  watchSymbols: string[];
}

export interface HoldingSnapshot {
  symbol: string;
  exchange: ExchangeCode;
  currency: string;
  quantity: number;
  orderableQuantity: number;
  averagePrice: number;
  currentPrice: number;
  profitPercent: number;
  profitAmount: number;
  evaluatedAmount: number;
  updatedAt: string;
}

export interface AccountSummary {
  heldSymbolCount: number;
  totalHoldingQuantity: number;
  orderableCashUsd: number;
  currency: string;
  updatedAt?: string;
}

export interface AutoSellEvent {
  id: string;
  symbol: string;
  exchange: ExchangeCode;
  quantity: number;
  entryPrice?: number;
  triggerProfitPercent: number;
  targetProfitPercent: number;
  orderPrice: number;
  status: "submitted" | "skipped" | "failed" | "cancelled" | "completed";
  reason: string;
  createdAt: string;
  orderNumber?: string;
}

export interface TradingOrderQueueItem {
  id: string;
  kind: "auto_sell" | "one_click_buy" | "buy_modify" | "buy_cancel";
  targetId: string;
  symbol: string;
  exchange: ExchangeCode;
  quantity: number;
  limitPrice: number;
  triggerProfitPercent: number;
  targetProfitPercent: number;
  status: "queued" | "running" | "retry_wait" | "blocked";
  attemptCount: number;
  createdAt: string;
  updatedAt: string;
  nextAttemptAt: string;
  lastAttemptAt?: string;
  lastError?: string;
}

export type ProfitLedgerRangeCode = "1d" | "7d" | "14d" | "30d" | "6m" | "1y";

export interface ProfitLedgerEntry {
  id: string;
  sourceEventId: string;
  symbol: string;
  exchange: ExchangeCode;
  quantity: number;
  entryPrice: number;
  exitPrice: number;
  realizedProfitUsd: number;
  realizedProfitPercent: number;
  targetProfitPercent: number;
  costBasisMode: "exact_fifo" | "estimated_fifo";
  matchedQuantity: number;
  estimatedQuantity: number;
  completedAt: string;
  orderNumber?: string;
}

export interface ProfitLedgerRangeSummary {
  code: ProfitLedgerRangeCode;
  label: string;
  realizedProfitUsd: number;
  tradeCount: number;
  chart: ProfitLedgerChartPoint[];
}

export interface ProfitLedgerChartPoint {
  at: string;
  realizedProfitUsd: number;
  cumulativeProfitUsd: number;
  tradeCount: number;
}

export interface ProfitLedgerSnapshot {
  updatedAt: string;
  totalRealizedProfitUsd: number;
  totalTradeCount: number;
  exactTradeCount: number;
  estimatedTradeCount: number;
  ranges: ProfitLedgerRangeSummary[];
  recentEntries: ProfitLedgerEntry[];
}

export interface AutoSellTarget {
  id: string;
  symbol: string;
  exchange: ExchangeCode;
  requestedQuantity: number;
  remainingQuantity: number;
  entryPrice: number;
  targetPrice: number;
  targetProfitPercent: number;
  status: "armed" | "completed" | "cancelled";
  buyOrderStatus: "submitted" | "partially_filled" | "filled" | "cancelled" | "rejected" | "unknown";
  buyFilledQuantity: number;
  buyOpenQuantity: number;
  createdAt: string;
  completedAt?: string;
  cancelledAt?: string;
  buyOrderNumber?: string;
  buyOrderUpdatedAt?: string;
}

export interface OneClickBuyRequest {
  symbol: string;
  exchange: ExchangeCode;
  quantity: number;
  limitPrice: number;
}

export interface OneClickBuyResponse {
  targetId: string;
  symbol: string;
  exchange: ExchangeCode;
  quantity: number;
  limitPrice: number;
  targetProfitPercent: number;
  targetPrice: number;
  orderNumber?: string;
  submittedAt: string;
  message: string;
}

export interface OneClickBuyPrecheckItem {
  code: "kis_connection" | "orderable_cash" | "market_session";
  status: "pass" | "warn" | "fail";
  title: string;
  detail: string;
}

export interface OneClickBuyPrecheckResponse {
  ready: boolean;
  checkedAt: string;
  estimatedOrderValueUsd: number;
  orderableCashUsd: number;
  checks: OneClickBuyPrecheckItem[];
}

export interface SymbolSearchResult {
  symbol: string;
  name: string;
  exchange: ExchangeCode;
  exchangeLabel: string;
  quoteType: "EQUITY" | "ETF";
}

export interface WatchlistSymbolInput {
  symbol: string;
  name: string;
  exchange: ExchangeCode;
  exchangeLabel: string;
}

export interface WatchlistQuote {
  symbol: string;
  name: string;
  exchange: ExchangeCode;
  exchangeLabel: string;
  currentPrice: number;
  previousClose: number;
  dayChangeUsd: number;
  dayChangePercent: number;
  oneMonthReturn: number;
  threeMonthReturn: number;
  monitoringLabel: string;
  momentumTone: "positive" | "neutral" | "negative";
  lastUpdatedAt: string;
}

export interface WatchlistMonitorSnapshot {
  updatedAt: string;
  items: WatchlistQuote[];
}

export interface TradingStatus {
  settings: AutoSellSettings;
  monitorRunning: boolean;
  lastCheckedAt?: string;
  lastError?: string;
  holdings: HoldingSnapshot[];
  accountSummary: AccountSummary;
  autoSellTargets: AutoSellTarget[];
  orderQueue: TradingOrderQueueItem[];
  recentEvents: AutoSellEvent[];
  profitLedger: ProfitLedgerSnapshot;
}

export interface PriceHistoryPoint {
  date: string;
  label: string;
  price: number;
  kind: "three_months_ago" | "recent_daily" | "current";
}

export interface RankedAsset {
  symbol: string;
  name: string;
  nameKo: string;
  category: string;
  descriptionKo: string;
  currentPrice: number;
  metricLabel?: string;
  marketCap?: number;
  oneMonthReturn: number;
  threeMonthReturn: number;
  priceHistory: PriceHistoryPoint[];
  extendedPriceHistory: PriceHistoryPoint[];
  intradayPriceHistory: PriceHistoryPoint[];
  score: number;
  notes: string[];
}

export interface AnalysisSection {
  title: string;
  summary: string;
  bullets: string[];
  confidence: "low" | "medium" | "high";
}

export interface DailyAnalysisSnapshot {
  dateKey: string;
  generatedAt: string;
  sections: AnalysisSection[];
}

export interface MarketDashboard {
  generatedAt: string;
  analysisGeneratedAt: string;
  usdKrwRate: number;
  usdKrwUpdatedAt?: string;
  blueChips: RankedAsset[];
  trendingThemes: RankedAsset[];
  sectorLeaders: RankedAsset[];
  industryMomentumLeaders: RankedAsset[];
  analysis: AnalysisSection[];
  analysisHistory: DailyAnalysisSnapshot[];
}

export interface DashboardResponse {
  trading: TradingStatus;
  market: MarketDashboard;
  llm: {
    provider: "codex-cli";
    model: string;
    loginStatus: string;
  };
}
