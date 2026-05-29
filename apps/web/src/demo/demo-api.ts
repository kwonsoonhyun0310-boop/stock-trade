import type {
  AnalysisSection,
  AutoSellEvent,
  AutoSellTarget,
  DashboardResponse,
  DailyAnalysisSnapshot,
  ExchangeCode,
  HoldingSnapshot,
  OneClickBuyPrecheckResponse,
  OneClickBuyRequest,
  OneClickBuyResponse,
  PriceHistoryPoint,
  ProfitLedgerEntry,
  RankedAsset,
  SymbolSearchResult,
  TradingOrderQueueItem,
  TradingStatus,
  WatchlistMonitorSnapshot,
  WatchlistQuote,
  WatchlistSymbolInput
} from "@trade/shared";

const now = () => new Date();
const isoMinutesAgo = (minutesAgo: number) => new Date(Date.now() - minutesAgo * 60_000).toISOString();
const isoDaysAgo = (daysAgo: number) => new Date(Date.now() - daysAgo * 24 * 60_000 * 60).toISOString();
const rounded = (value: number) => Number(value.toFixed(2));

interface DemoSymbolSeed {
  symbol: string;
  name: string;
  nameKo: string;
  exchange: ExchangeCode;
  exchangeLabel: string;
  category: string;
  descriptionKo: string;
  currentPrice: number;
  previousClose: number;
  oneMonthReturn: number;
  threeMonthReturn: number;
  score: number;
}

const DEMO_SYMBOLS: DemoSymbolSeed[] = [
  {
    symbol: "NVDA",
    name: "NVIDIA",
    nameKo: "엔비디아",
    exchange: "NASD",
    exchangeLabel: "NASDAQ",
    category: "AI Semiconductor",
    descriptionKo: "AI 가속기와 GPU 시장을 주도하는 반도체 회사",
    currentPrice: 126.4,
    previousClose: 124.7,
    oneMonthReturn: 8.6,
    threeMonthReturn: 14.1,
    score: 94.2
  },
  {
    symbol: "MSFT",
    name: "Microsoft",
    nameKo: "마이크로소프트",
    exchange: "NASD",
    exchangeLabel: "NASDAQ",
    category: "Cloud Platform",
    descriptionKo: "클라우드, 오피스, AI 서비스를 함께 운영하는 대형 소프트웨어 회사",
    currentPrice: 427.85,
    previousClose: 425.91,
    oneMonthReturn: 5.2,
    threeMonthReturn: 9.4,
    score: 90.1
  },
  {
    symbol: "AVGO",
    name: "Broadcom",
    nameKo: "브로드컴",
    exchange: "NASD",
    exchangeLabel: "NASDAQ",
    category: "AI Infrastructure",
    descriptionKo: "데이터센터와 네트워크 반도체에서 강한 회사",
    currentPrice: 1728.35,
    previousClose: 1719.1,
    oneMonthReturn: 7.8,
    threeMonthReturn: 11.5,
    score: 88.8
  },
  {
    symbol: "LLY",
    name: "Eli Lilly",
    nameKo: "일라이 릴리",
    exchange: "NYSE",
    exchangeLabel: "NYSE",
    category: "Healthcare",
    descriptionKo: "비만 치료제와 제약 파이프라인으로 주목받는 제약 회사",
    currentPrice: 812.2,
    previousClose: 808.42,
    oneMonthReturn: 4.7,
    threeMonthReturn: 6.4,
    score: 84.9
  },
  {
    symbol: "JPM",
    name: "JPMorgan Chase",
    nameKo: "JP모건",
    exchange: "NYSE",
    exchangeLabel: "NYSE",
    category: "Financials",
    descriptionKo: "미국 대형 은행으로 금리와 경기 흐름의 영향을 크게 받는 금융주",
    currentPrice: 214.63,
    previousClose: 213.12,
    oneMonthReturn: 3.5,
    threeMonthReturn: 7.2,
    score: 79.4
  },
  {
    symbol: "AAPL",
    name: "Apple",
    nameKo: "애플",
    exchange: "NASD",
    exchangeLabel: "NASDAQ",
    category: "Consumer Tech",
    descriptionKo: "아이폰과 서비스 생태계를 가진 대표 소비자 기술 회사",
    currentPrice: 196.24,
    previousClose: 197.3,
    oneMonthReturn: -1.8,
    threeMonthReturn: 2.7,
    score: 71.3
  }
];

const symbolByTicker = new Map(DEMO_SYMBOLS.map((symbol) => [symbol.symbol, symbol]));

const toPricePoint = (
  label: string,
  date: string,
  price: number,
  kind: PriceHistoryPoint["kind"] = "recent_daily"
): PriceHistoryPoint => ({
  label,
  date,
  price: rounded(price),
  kind
});

const buildRecentHistory = (seed: DemoSymbolSeed): PriceHistoryPoint[] => {
  const base = seed.currentPrice / (1 + seed.threeMonthReturn / 100);
  const monthBase = seed.currentPrice / (1 + seed.oneMonthReturn / 100);

  return [
    toPricePoint("3달 전", isoDaysAgo(90), base, "three_months_ago"),
    toPricePoint("4. 29.", isoDaysAgo(30), monthBase),
    toPricePoint("5. 06.", isoDaysAgo(23), monthBase * 1.01),
    toPricePoint("5. 13.", isoDaysAgo(16), monthBase * 1.02),
    toPricePoint("5. 20.", isoDaysAgo(9), monthBase * 1.03),
    toPricePoint("5. 27.", isoDaysAgo(2), seed.previousClose),
    toPricePoint("현재", now().toISOString(), seed.currentPrice, "current")
  ];
};

const buildExtendedHistory = (seed: DemoSymbolSeed): PriceHistoryPoint[] => {
  const current = seed.currentPrice;
  return [
    toPricePoint("3년 전", isoDaysAgo(365 * 3), current * 0.42, "three_months_ago"),
    toPricePoint("24. 11.", isoDaysAgo(210), current * 0.63),
    toPricePoint("25. 01.", isoDaysAgo(150), current * 0.71),
    toPricePoint("25. 03.", isoDaysAgo(90), current * 0.82),
    toPricePoint("25. 05.", isoDaysAgo(30), current * 0.94),
    toPricePoint("현재", now().toISOString(), current, "current")
  ];
};

const buildIntradayHistory = (seed: DemoSymbolSeed): PriceHistoryPoint[] => {
  const start = Date.now() - 4.5 * 60 * 60_000;
  const points = [0, 1, 2, 3, 4, 5].map((step) => {
    const price = seed.previousClose + (seed.currentPrice - seed.previousClose) * (step / 5);
    return toPricePoint(
      `${step === 0 ? "30분 간격 시작" : `${step * 30}분 후`}`,
      new Date(start + step * 30 * 60_000).toISOString(),
      price,
      step === 5 ? "current" : "recent_daily"
    );
  });

  points[points.length - 1] = toPricePoint("현재", now().toISOString(), seed.currentPrice, "current");
  return points;
};

const toRankedAsset = (seed: DemoSymbolSeed): RankedAsset => ({
  symbol: seed.symbol,
  name: seed.name,
  nameKo: seed.nameKo,
  category: seed.category,
  descriptionKo: seed.descriptionKo,
  currentPrice: seed.currentPrice,
  oneMonthReturn: seed.oneMonthReturn,
  threeMonthReturn: seed.threeMonthReturn,
  priceHistory: buildRecentHistory(seed),
  extendedPriceHistory: buildExtendedHistory(seed),
  intradayPriceHistory: buildIntradayHistory(seed),
  score: seed.score,
  notes: [
    `한 달 전보다 ${Math.abs(seed.oneMonthReturn).toFixed(1)}% ${seed.oneMonthReturn >= 0 ? "높아요" : "낮아요"}`,
    `세 달 전보다 ${Math.abs(seed.threeMonthReturn).toFixed(1)}% ${seed.threeMonthReturn >= 0 ? "높아요" : "낮아요"}`,
    `${seed.category} 흐름을 대표하는 데모 종목`
  ]
});

const createHolding = (seed: DemoSymbolSeed, quantity: number, averagePrice: number): HoldingSnapshot => {
  const profitAmount = rounded((seed.currentPrice - averagePrice) * quantity);
  const evaluatedAmount = rounded(seed.currentPrice * quantity);
  return {
    symbol: seed.symbol,
    exchange: seed.exchange,
    currency: "USD",
    quantity,
    orderableQuantity: quantity,
    averagePrice,
    currentPrice: seed.currentPrice,
    profitPercent: rounded(((seed.currentPrice - averagePrice) / averagePrice) * 100),
    profitAmount,
    evaluatedAmount,
    updatedAt: isoMinutesAgo(1)
  };
};

const analysisHistory: DailyAnalysisSnapshot[] = [
  {
    dateKey: "2026-05-29",
    generatedAt: isoMinutesAgo(40),
    sections: [
      {
        title: "현재 트렌드",
        summary: "AI 인프라와 대형 소프트웨어 쪽이 시장 주도권을 유지하고 있고, 금융은 보조적으로 받쳐주는 구조입니다.",
        bullets: [
          "엔비디아, 브로드컴, 마이크로소프트처럼 AI 수혜가 분명한 종목이 상단에 있습니다.",
          "헬스케어와 금융은 공격적인 리더는 아니지만 지수 버팀목 역할을 하고 있습니다."
        ],
        confidence: "high"
      },
      {
        title: "시장 구조",
        summary: "완만한 상향 구조지만, 대형 기술주 집중도가 높아서 개별 종목 선택이 중요합니다.",
        bullets: [
          "대형 기술주가 상승을 이끌고 있어 지수는 강해 보여도 전체 종목이 다 강한 장은 아닙니다.",
          "이런 구조에서는 추세가 약한 종목보다 강한 종목을 따라가는 전략이 유리합니다."
        ],
        confidence: "medium"
      }
    ]
  },
  {
    dateKey: "2026-05-28",
    generatedAt: isoDaysAgo(1),
    sections: [
      {
        title: "현재 트렌드",
        summary: "AI 반도체와 클라우드 쪽 강세가 유지되고, 경기민감주는 선택적으로 따라오는 하루였습니다.",
        bullets: [
          "반도체 ETF와 대형 AI 인프라 종목에 자금이 계속 붙었습니다.",
          "방어주는 크게 나쁘지 않지만 주도 업종은 아니었습니다."
        ],
        confidence: "medium"
      }
    ]
  }
];

const baseProfitEntries: ProfitLedgerEntry[] = [
  {
    id: "ledger-1",
    sourceEventId: "event-ledger-1",
    symbol: "NVDA",
    exchange: "NASD",
    quantity: 4,
    entryPrice: 118.4,
    exitPrice: 124.95,
    realizedProfitUsd: 26.2,
    realizedProfitPercent: 5.53,
    targetProfitPercent: 5,
    costBasisMode: "exact_fifo",
    matchedQuantity: 4,
    estimatedQuantity: 0,
    completedAt: isoDaysAgo(2),
    orderNumber: "D-SELL-1001"
  },
  {
    id: "ledger-2",
    sourceEventId: "event-ledger-2",
    symbol: "MSFT",
    exchange: "NASD",
    quantity: 2,
    entryPrice: 409.2,
    exitPrice: 430.1,
    realizedProfitUsd: 41.8,
    realizedProfitPercent: 5.11,
    targetProfitPercent: 5,
    costBasisMode: "estimated_fifo",
    matchedQuantity: 1,
    estimatedQuantity: 1,
    completedAt: isoDaysAgo(12),
    orderNumber: "D-SELL-1002"
  }
];

const queueItems: TradingOrderQueueItem[] = [
  {
    id: "queue-1",
    kind: "auto_sell",
    targetId: "target-2",
    symbol: "AVGO",
    exchange: "NASD",
    quantity: 1,
    limitPrice: 1728.35,
    triggerProfitPercent: 4.72,
    targetProfitPercent: 5,
    status: "retry_wait",
    attemptCount: 1,
    createdAt: isoMinutesAgo(14),
    updatedAt: isoMinutesAgo(2),
    nextAttemptAt: isoMinutesAgo(-1),
    lastAttemptAt: isoMinutesAgo(2),
    lastError: "데모 모드에서 재시도 큐 예시를 보여줍니다."
  }
];

const targetEntries: AutoSellTarget[] = [
  {
    id: "target-1",
    symbol: "NVDA",
    exchange: "NASD",
    requestedQuantity: 6,
    remainingQuantity: 6,
    entryPrice: 120.4,
    targetPrice: 126.42,
    targetProfitPercent: 5,
    status: "armed",
    buyOrderStatus: "filled",
    buyFilledQuantity: 6,
    buyOpenQuantity: 0,
    createdAt: isoMinutesAgo(90),
    buyOrderNumber: "D-BUY-1001",
    buyOrderUpdatedAt: isoMinutesAgo(88)
  },
  {
    id: "target-2",
    symbol: "AVGO",
    exchange: "NASD",
    requestedQuantity: 1,
    remainingQuantity: 1,
    entryPrice: 1652.5,
    targetPrice: 1735.13,
    targetProfitPercent: 5,
    status: "armed",
    buyOrderStatus: "partially_filled",
    buyFilledQuantity: 1,
    buyOpenQuantity: 0,
    createdAt: isoMinutesAgo(26),
    buyOrderNumber: "D-BUY-1002",
    buyOrderUpdatedAt: isoMinutesAgo(20)
  }
];

let demoEvents: AutoSellEvent[] = [
  {
    id: "event-1",
    symbol: "NVDA",
    exchange: "NASD",
    quantity: 6,
    entryPrice: 120.4,
    triggerProfitPercent: 0,
    targetProfitPercent: 5,
    orderPrice: 120.4,
    status: "completed",
    reason: "원클릭 매수 주문이 전량 체결되어 6주 자동매도 추적이 유지됩니다.",
    createdAt: isoMinutesAgo(88),
    orderNumber: "D-BUY-1001"
  },
  {
    id: "event-2",
    symbol: "AVGO",
    exchange: "NASD",
    quantity: 1,
    entryPrice: 1652.5,
    triggerProfitPercent: 0,
    targetProfitPercent: 5,
    orderPrice: 1652.5,
    status: "submitted",
    reason: "원클릭 매수 주문이 접수되어 5% 자동매도 대기 중입니다.",
    createdAt: isoMinutesAgo(24),
    orderNumber: "D-BUY-1002"
  }
];

let demoTargets: AutoSellTarget[] = [...targetEntries];
let demoQueue: TradingOrderQueueItem[] = [...queueItems];
let demoHoldings: HoldingSnapshot[] = [
  createHolding(symbolByTicker.get("NVDA")!, 6, 120.4),
  createHolding(symbolByTicker.get("MSFT")!, 2, 409.2),
  createHolding(symbolByTicker.get("AAPL")!, 5, 201.8)
];
let demoProfitLedgerEntries = [...baseProfitEntries];
let demoCashUsd = 18450;

const buildProfitRanges = (entries: ProfitLedgerEntry[]) => {
  const ranges = [
    { code: "1d", label: "1일", days: 1 },
    { code: "7d", label: "7일", days: 7 },
    { code: "14d", label: "14일", days: 14 },
    { code: "30d", label: "30일", days: 30 },
    { code: "6m", label: "6개월", days: 180 },
    { code: "1y", label: "1년", days: 365 }
  ] as const;

  return ranges.map((range) => {
    const start = Date.now() - range.days * 24 * 60 * 60_000;
    const filtered = entries.filter((entry) => new Date(entry.completedAt).getTime() >= start);
    let cumulative = 0;
    let tradeCount = 0;
    const chart = [
      {
        at: new Date(start).toISOString(),
        realizedProfitUsd: 0,
        cumulativeProfitUsd: 0,
        tradeCount: 0
      }
    ];

    for (const entry of [...filtered].sort((left, right) => left.completedAt.localeCompare(right.completedAt))) {
      cumulative += entry.realizedProfitUsd;
      tradeCount += 1;
      chart.push({
        at: entry.completedAt,
        realizedProfitUsd: rounded(entry.realizedProfitUsd),
        cumulativeProfitUsd: rounded(cumulative),
        tradeCount
      });
    }

    chart.push({
      at: now().toISOString(),
      realizedProfitUsd: 0,
      cumulativeProfitUsd: rounded(cumulative),
      tradeCount
    });

    return {
      code: range.code,
      label: range.label,
      realizedProfitUsd: rounded(filtered.reduce((sum, entry) => sum + entry.realizedProfitUsd, 0)),
      tradeCount: filtered.length,
      chart
    };
  });
};

const buildTradingStatus = (): TradingStatus => ({
  settings: {
    enabled: true,
    targetProfitPercent: 5,
    pollIntervalMs: 5_000,
    watchSymbols: []
  },
  monitorRunning: true,
  lastCheckedAt: isoMinutesAgo(0),
  lastError: undefined,
  holdings: demoHoldings,
  accountSummary: {
    heldSymbolCount: demoHoldings.length,
    totalHoldingQuantity: demoHoldings.reduce((sum, holding) => sum + holding.quantity, 0),
    orderableCashUsd: rounded(demoCashUsd),
    currency: "USD",
    updatedAt: isoMinutesAgo(3)
  },
  autoSellTargets: [...demoTargets].sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
  orderQueue: [...demoQueue].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)),
  recentEvents: [...demoEvents].sort((left, right) => right.createdAt.localeCompare(left.createdAt)).slice(0, 12),
  profitLedger: {
    updatedAt: isoMinutesAgo(0),
    totalRealizedProfitUsd: rounded(demoProfitLedgerEntries.reduce((sum, entry) => sum + entry.realizedProfitUsd, 0)),
    totalTradeCount: demoProfitLedgerEntries.length,
    exactTradeCount: demoProfitLedgerEntries.filter((entry) => entry.costBasisMode === "exact_fifo").length,
    estimatedTradeCount: demoProfitLedgerEntries.filter((entry) => entry.costBasisMode === "estimated_fifo").length,
    ranges: buildProfitRanges(demoProfitLedgerEntries),
    recentEntries: [...demoProfitLedgerEntries].sort((left, right) => right.completedAt.localeCompare(left.completedAt))
  }
});

const marketLeaders = DEMO_SYMBOLS.map(toRankedAsset);

const buildDemoDashboard = (): DashboardResponse => ({
  trading: buildTradingStatus(),
  market: {
    generatedAt: isoMinutesAgo(20),
    analysisGeneratedAt: isoMinutesAgo(40),
    usdKrwRate: 1376.4,
    usdKrwUpdatedAt: isoMinutesAgo(18),
    blueChips: marketLeaders,
    trendingThemes: marketLeaders.slice(0, 5).map((item, index) => ({
      ...item,
      symbol: ["SMH", "IGV", "XLI", "PAVE", "XLE"][index] ?? item.symbol,
      name: ["VanEck Semiconductor ETF", "iShares Software ETF", "Industrial Select Sector SPDR", "Global X U.S. Infrastructure", "Energy Select Sector SPDR"][index] ?? item.name,
      nameKo: ["반도체 ETF", "소프트웨어 ETF", "산업재 ETF", "미국 인프라 ETF", "에너지 ETF"][index] ?? item.nameKo,
      category: "Theme ETF",
      descriptionKo: "현재 강한 테마 흐름을 보여주는 데모 ETF",
      score: item.score - 3 + index
    })),
    sectorLeaders: marketLeaders.slice(1, 6).map((item, index) => ({
      ...item,
      symbol: ["XLK", "XLI", "XLF", "XLV", "XLE"][index] ?? item.symbol,
      name: ["Technology", "Industrials", "Financials", "Health Care", "Energy"][index] ?? item.name,
      nameKo: ["기술", "산업재", "금융", "헬스케어", "에너지"][index] ?? item.nameKo,
      category: "Sector ETF",
      descriptionKo: "미국 주요 섹터별 흐름을 비교하는 데모 ETF",
      score: item.score - 5 + index
    })),
    industryMomentumLeaders: marketLeaders.map((item, index) => ({
      ...item,
      symbol: ["AI-CHIP", "CLOUD", "POWER", "DEFENSE", "PAYMENT", "HEALTH"][index] ?? item.symbol,
      name: ["AI Chip Design", "Cloud Software", "Power Infrastructure", "Aerospace & Defense", "Digital Payments", "Biotech Leaders"][index] ?? item.name,
      nameKo: ["AI 반도체 설계", "클라우드 소프트웨어", "전력 인프라", "항공우주·방산", "디지털 결제", "바이오 리더"][index] ?? item.nameKo,
      category: "Pure Industry Momentum",
      descriptionKo: "ETF가 아닌 개별 기업 묶음으로 만든 순수 업종 모멘텀 데모 지수",
      metricLabel: `분야 지수 ${(item.currentPrice / 2).toFixed(1)}`,
      score: item.score - 4 + index
    })),
    analysis: analysisHistory[0].sections,
    analysisHistory
  },
  llm: {
    provider: "codex-cli",
    model: "gpt-5.2-codex",
    loginStatus: "데모 모드"
  }
});

const searchUniverse: SymbolSearchResult[] = DEMO_SYMBOLS.map((seed) => ({
  symbol: seed.symbol,
  name: seed.name,
  exchange: seed.exchange,
  exchangeLabel: seed.exchangeLabel,
  quoteType: "EQUITY"
}));

export const getDemoDashboard = async () => structuredClone(buildDemoDashboard());

export const getDemoTradingStatus = async () => structuredClone(buildTradingStatus());

export const refreshDemoTradingStatus = async () => {
  const status = buildTradingStatus();
  return structuredClone(status);
};

export const precheckDemoOneClickBuy = async (
  order: OneClickBuyRequest
): Promise<OneClickBuyPrecheckResponse> => {
  const estimatedOrderValueUsd = rounded(order.quantity * order.limitPrice);
  const enoughCash = demoCashUsd >= estimatedOrderValueUsd;

  return {
    ready: enoughCash,
    checkedAt: now().toISOString(),
    estimatedOrderValueUsd,
    orderableCashUsd: rounded(demoCashUsd),
    checks: [
      {
        code: "market_session",
        status: "pass",
        title: "시장 상태",
        detail: "데모 모드에서는 미국 정규장처럼 주문이 가능하도록 표시합니다."
      },
      {
        code: "kis_connection",
        status: "pass",
        title: "데모 백엔드",
        detail: "이 화면은 GitHub Pages용 데모 데이터로 동작합니다."
      },
      {
        code: "orderable_cash",
        status: enoughCash ? "pass" : "fail",
        title: "주문 가능 현금",
        detail: enoughCash
          ? `주문 가능 현금 ${demoCashUsd.toFixed(2)} USD로 매수가 가능합니다.`
          : `주문 가능 현금 ${demoCashUsd.toFixed(2)} USD보다 주문 금액이 큽니다.`
      }
    ]
  };
};

export const submitDemoOneClickBuy = async (
  order: OneClickBuyRequest
): Promise<OneClickBuyResponse> => {
  const seed = symbolByTicker.get(order.symbol);

  if (!seed) {
    throw new Error("데모 모드에 등록된 종목이 아닙니다.");
  }

  const estimatedOrderValueUsd = rounded(order.quantity * order.limitPrice);

  if (estimatedOrderValueUsd > demoCashUsd) {
    throw new Error("데모 모드 기준 주문 가능 현금이 부족합니다.");
  }

  const submittedAt = now().toISOString();
  const targetId = `demo-target-${Date.now()}`;
  const orderNumber = `D-BUY-${String(Date.now()).slice(-6)}`;
  const targetPrice = rounded(order.limitPrice * 1.05);

  demoCashUsd = rounded(demoCashUsd - estimatedOrderValueUsd);
  demoTargets = [
    {
      id: targetId,
      symbol: order.symbol,
      exchange: order.exchange,
      requestedQuantity: order.quantity,
      remainingQuantity: order.quantity,
      entryPrice: order.limitPrice,
      targetPrice,
      targetProfitPercent: 5,
      status: "armed",
      buyOrderStatus: "submitted",
      buyFilledQuantity: 0,
      buyOpenQuantity: order.quantity,
      createdAt: submittedAt,
      buyOrderNumber: orderNumber,
      buyOrderUpdatedAt: submittedAt
    },
    ...demoTargets
  ];
  demoQueue = demoQueue.filter((item) => item.targetId !== targetId);
  demoEvents = [
    {
      id: `event-${Date.now()}`,
      symbol: order.symbol,
      exchange: order.exchange,
      quantity: order.quantity,
      entryPrice: order.limitPrice,
      triggerProfitPercent: 0,
      targetProfitPercent: 5,
      orderPrice: order.limitPrice,
      status: "submitted",
      reason: "데모 모드에서 원클릭 매수 주문이 접수된 예시입니다.",
      createdAt: submittedAt,
      orderNumber
    },
    ...demoEvents
  ];

  return {
    targetId,
    symbol: order.symbol,
    exchange: order.exchange,
    quantity: order.quantity,
    limitPrice: order.limitPrice,
    targetProfitPercent: 5,
    targetPrice,
    orderNumber,
    submittedAt,
    message: "데모 원클릭 매수 주문이 접수되었습니다."
  };
};

export const cancelDemoAutoSellTarget = async (targetId: string) => {
  demoTargets = demoTargets.map((target) =>
    target.id === targetId
      ? {
          ...target,
          status: "cancelled",
          cancelledAt: now().toISOString()
        }
      : target
  );
  return structuredClone(buildTradingStatus());
};

export const modifyDemoBuyOrder = async (targetId: string, limitPrice: number) => {
  demoTargets = demoTargets.map((target) =>
    target.id === targetId
      ? {
          ...target,
          entryPrice: rounded(limitPrice),
          targetPrice: rounded(limitPrice * 1.05),
          buyOrderUpdatedAt: now().toISOString()
        }
      : target
  );
  return structuredClone(buildTradingStatus());
};

export const cancelDemoBuyOrder = async (targetId: string) => {
  demoTargets = demoTargets.map((target) =>
    target.id === targetId
      ? {
          ...target,
          buyOrderStatus: "cancelled",
          buyOpenQuantity: 0,
          buyOrderUpdatedAt: now().toISOString(),
          status: "cancelled",
          cancelledAt: now().toISOString()
        }
      : target
  );
  return structuredClone(buildTradingStatus());
};

export const searchDemoSymbols = async (query: string) => {
  const normalized = query.trim().toUpperCase();

  return searchUniverse.filter(
    (candidate) =>
      candidate.symbol.includes(normalized) ||
      candidate.name.toUpperCase().includes(normalized)
  );
};

export const getDemoWatchlistQuotes = async (
  favorites: WatchlistSymbolInput[]
): Promise<WatchlistMonitorSnapshot> => {
  const items: WatchlistQuote[] = favorites.flatMap((favorite) => {
    const seed = symbolByTicker.get(favorite.symbol);

    if (!seed) {
      return [];
    }

    const dayChangeUsd = rounded(seed.currentPrice - seed.previousClose);
    const dayChangePercent =
      seed.previousClose > 0 ? rounded((dayChangeUsd / seed.previousClose) * 100) : 0;
    const momentumTone =
      seed.oneMonthReturn >= 4 ? "positive" : seed.oneMonthReturn <= -4 ? "negative" : "neutral";

    return [
      {
        symbol: favorite.symbol,
        name: favorite.name,
        exchange: favorite.exchange,
        exchangeLabel: favorite.exchangeLabel,
        currentPrice: seed.currentPrice,
        previousClose: seed.previousClose,
        dayChangeUsd,
        dayChangePercent,
        oneMonthReturn: seed.oneMonthReturn,
        threeMonthReturn: seed.threeMonthReturn,
        monitoringLabel:
          momentumTone === "positive"
            ? "최근 흐름이 강한 종목"
            : momentumTone === "negative"
              ? "최근 흐름이 약한 종목"
              : "큰 방향 없이 관찰 중",
        momentumTone,
        lastUpdatedAt: now().toISOString()
      }
    ];
  });

  return {
    updatedAt: now().toISOString(),
    items
  };
};
