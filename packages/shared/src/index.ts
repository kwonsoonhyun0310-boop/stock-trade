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

export interface AutoSellEvent {
  id: string;
  symbol: string;
  exchange: ExchangeCode;
  quantity: number;
  triggerProfitPercent: number;
  targetProfitPercent: number;
  orderPrice: number;
  status: "submitted" | "skipped" | "failed";
  reason: string;
  createdAt: string;
  orderNumber?: string;
}

export interface ManualOrderRequest {
  side: "buy" | "sell";
  symbol: string;
  exchange: ExchangeCode;
  quantity: number;
  limitPrice: number;
}

export interface ManualOrderResponse {
  symbol: string;
  exchange: ExchangeCode;
  side: "buy" | "sell";
  quantity: number;
  limitPrice: number;
  orderNumber?: string;
  submittedAt: string;
  message: string;
}

export interface TradingStatus {
  settings: AutoSellSettings;
  monitorRunning: boolean;
  lastCheckedAt?: string;
  lastError?: string;
  holdings: HoldingSnapshot[];
  recentEvents: AutoSellEvent[];
}

export interface RankedAsset {
  symbol: string;
  name: string;
  category: string;
  currentPrice: number;
  marketCap?: number;
  oneMonthReturn: number;
  threeMonthReturn: number;
  score: number;
  notes: string[];
}

export interface AnalysisSection {
  title: string;
  summary: string;
  bullets: string[];
  confidence: "low" | "medium" | "high";
}

export interface MarketDashboard {
  generatedAt: string;
  blueChips: RankedAsset[];
  trendingThemes: RankedAsset[];
  sectorLeaders: RankedAsset[];
  analysis: AnalysisSection[];
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
