import type {
  AutoSellEvent,
  ProfitLedgerChartPoint,
  ProfitLedgerEntry,
  ProfitLedgerRangeCode,
  ProfitLedgerRangeSummary,
  ProfitLedgerSnapshot
} from "@trade/shared";

const toRoundedNumber = (value: number) => Number(value.toFixed(2));

const shiftUtcDays = (date: Date, days: number) => {
  const nextDate = new Date(date);
  nextDate.setUTCDate(nextDate.getUTCDate() - days);
  return nextDate;
};

const shiftUtcMonths = (date: Date, months: number) => {
  const nextDate = new Date(date);
  nextDate.setUTCMonth(nextDate.getUTCMonth() - months);
  return nextDate;
};

const PROFIT_LEDGER_RANGES: Array<{
  code: ProfitLedgerRangeCode;
  label: string;
  getStart: (endAt: Date) => Date;
}> = [
  { code: "1d", label: "1일", getStart: (endAt) => shiftUtcDays(endAt, 1) },
  { code: "7d", label: "7일", getStart: (endAt) => shiftUtcDays(endAt, 7) },
  { code: "14d", label: "14일", getStart: (endAt) => shiftUtcDays(endAt, 14) },
  { code: "30d", label: "30일", getStart: (endAt) => shiftUtcDays(endAt, 30) },
  { code: "6m", label: "6개월", getStart: (endAt) => shiftUtcMonths(endAt, 6) },
  { code: "1y", label: "1년", getStart: (endAt) => shiftUtcMonths(endAt, 12) }
];

const getLedgerIdentity = (entry: Pick<ProfitLedgerEntry, "sourceEventId" | "orderNumber">) =>
  entry.orderNumber ? `order:${entry.orderNumber}` : `event:${entry.sourceEventId}`;

const getLedgerEntryPriority = (entry: ProfitLedgerEntry) => {
  let priority = entry.costBasisMode === "exact_fifo" ? 2 : 1;

  if (entry.orderNumber?.startsWith("history-")) {
    priority += 1;
  }

  return priority;
};

const inferEntryPrice = (event: AutoSellEvent) => {
  if (Number.isFinite(event.entryPrice) && (event.entryPrice ?? 0) > 0) {
    return toRoundedNumber(event.entryPrice ?? 0);
  }

  const denominator = 1 + event.targetProfitPercent / 100;

  if (denominator > 0 && event.orderPrice > 0) {
    return toRoundedNumber(event.orderPrice / denominator);
  }

  return toRoundedNumber(Math.max(0, event.orderPrice));
};

const isCompletedAutoSellEvent = (event: AutoSellEvent) =>
  event.status === "completed" && event.reason.includes("자동매도");

export const normalizeProfitLedgerEntry = (entry: ProfitLedgerEntry): ProfitLedgerEntry => {
  const quantity = Math.max(0, Number(entry.quantity) || 0);
  const entryPrice = Math.max(0, Number(entry.entryPrice) || 0);
  const exitPrice = Math.max(0, Number(entry.exitPrice) || 0);
  const realizedProfitUsd = Number.isFinite(entry.realizedProfitUsd)
    ? toRoundedNumber(entry.realizedProfitUsd)
    : toRoundedNumber((exitPrice - entryPrice) * quantity);
  const realizedProfitPercent =
    Number.isFinite(entry.realizedProfitPercent) && entry.realizedProfitPercent !== 0
      ? toRoundedNumber(entry.realizedProfitPercent)
      : entryPrice > 0
        ? toRoundedNumber(((exitPrice - entryPrice) / entryPrice) * 100)
        : 0;

  return {
    ...entry,
    quantity,
    entryPrice: toRoundedNumber(entryPrice),
    exitPrice: toRoundedNumber(exitPrice),
    realizedProfitUsd,
    realizedProfitPercent,
    targetProfitPercent: Number.isFinite(entry.targetProfitPercent)
      ? toRoundedNumber(entry.targetProfitPercent)
      : 0,
    costBasisMode: entry.costBasisMode === "exact_fifo" ? "exact_fifo" : "estimated_fifo",
    matchedQuantity: Number.isFinite(entry.matchedQuantity) ? toRoundedNumber(entry.matchedQuantity) : 0,
    estimatedQuantity: Number.isFinite(entry.estimatedQuantity) ? toRoundedNumber(entry.estimatedQuantity) : quantity,
    completedAt: entry.completedAt || new Date(0).toISOString()
  };
};

export const dedupeProfitLedgerEntries = (entries: ProfitLedgerEntry[]) => {
  const pickedEntries = new Map<string, ProfitLedgerEntry>();

  for (const entry of [...entries].map(normalizeProfitLedgerEntry)) {
    const identity = getLedgerIdentity(entry);
    const current = pickedEntries.get(identity);

    if (!current) {
      pickedEntries.set(identity, entry);
      continue;
    }

    const currentPriority = getLedgerEntryPriority(current);
    const nextPriority = getLedgerEntryPriority(entry);

    if (nextPriority > currentPriority) {
      pickedEntries.set(identity, entry);
      continue;
    }

    if (nextPriority === currentPriority && entry.completedAt > current.completedAt) {
      pickedEntries.set(identity, entry);
    }
  }

  return [...pickedEntries.values()].sort((left, right) => right.completedAt.localeCompare(left.completedAt));
};

export const createProfitLedgerEntryFromEvent = (event: AutoSellEvent): ProfitLedgerEntry | null => {
  if (!isCompletedAutoSellEvent(event) || event.quantity <= 0 || event.orderPrice <= 0) {
    return null;
  }

  const entryPrice = inferEntryPrice(event);
  const exitPrice = toRoundedNumber(event.orderPrice);
  const realizedProfitUsd = toRoundedNumber((exitPrice - entryPrice) * event.quantity);
  const realizedProfitPercent =
    entryPrice > 0 ? toRoundedNumber(((exitPrice - entryPrice) / entryPrice) * 100) : 0;

  return {
    id: event.id,
    sourceEventId: event.id,
    symbol: event.symbol,
    exchange: event.exchange,
    quantity: event.quantity,
    entryPrice,
    exitPrice,
    realizedProfitUsd,
    realizedProfitPercent,
    targetProfitPercent: toRoundedNumber(event.targetProfitPercent),
    costBasisMode: "estimated_fifo",
    matchedQuantity: 0,
    estimatedQuantity: event.quantity,
    completedAt: event.createdAt,
    orderNumber: event.orderNumber
  };
};

const summarizeRange = (
  entries: ProfitLedgerEntry[],
  range: (typeof PROFIT_LEDGER_RANGES)[number],
  endAt: Date
): ProfitLedgerRangeSummary => {
  const startTime = range.getStart(endAt).getTime();
  const endTime = endAt.getTime();
  const rangeEntries = entries.filter((entry) => {
    const completedTime = new Date(entry.completedAt).getTime();
    return !Number.isNaN(completedTime) && completedTime >= startTime && completedTime <= endTime;
  });
  const chart = buildRangeChart(rangeEntries, startTime, endTime);

  return {
    code: range.code,
    label: range.label,
    realizedProfitUsd: toRoundedNumber(
      rangeEntries.reduce((sum, entry) => sum + entry.realizedProfitUsd, 0)
    ),
    tradeCount: rangeEntries.length,
    chart
  };
};

const buildRangeChart = (
  entries: ProfitLedgerEntry[],
  startTime: number,
  endTime: number
): ProfitLedgerChartPoint[] => {
  const startAt = new Date(startTime).toISOString();
  const endAt = new Date(endTime).toISOString();
  let cumulativeProfitUsd = 0;
  let tradeCount = 0;
  const points: ProfitLedgerChartPoint[] = [
    {
      at: startAt,
      realizedProfitUsd: 0,
      cumulativeProfitUsd: 0,
      tradeCount: 0
    }
  ];

  for (const entry of [...entries].sort((left, right) => left.completedAt.localeCompare(right.completedAt))) {
    cumulativeProfitUsd += entry.realizedProfitUsd;
    tradeCount += 1;
    points.push({
      at: entry.completedAt,
      realizedProfitUsd: toRoundedNumber(entry.realizedProfitUsd),
      cumulativeProfitUsd: toRoundedNumber(cumulativeProfitUsd),
      tradeCount
    });
  }

  const lastPoint = points[points.length - 1];

  if (lastPoint?.at !== endAt) {
    points.push({
      at: endAt,
      realizedProfitUsd: 0,
      cumulativeProfitUsd: toRoundedNumber(cumulativeProfitUsd),
      tradeCount
    });
  }

  return points;
};

export const summarizeProfitLedger = (
  entries: ProfitLedgerEntry[],
  snapshotAt = new Date().toISOString()
): ProfitLedgerSnapshot => {
  const normalizedEntries = dedupeProfitLedgerEntries(entries);
  const endAt = new Date(snapshotAt);
  const safeEndAt = Number.isNaN(endAt.getTime()) ? new Date() : endAt;

  return {
    updatedAt: safeEndAt.toISOString(),
    totalRealizedProfitUsd: toRoundedNumber(
      normalizedEntries.reduce((sum, entry) => sum + entry.realizedProfitUsd, 0)
    ),
    totalTradeCount: normalizedEntries.length,
    exactTradeCount: normalizedEntries.filter((entry) => entry.costBasisMode === "exact_fifo").length,
    estimatedTradeCount: normalizedEntries.filter((entry) => entry.costBasisMode === "estimated_fifo").length,
    ranges: PROFIT_LEDGER_RANGES.map((range) => summarizeRange(normalizedEntries, range, safeEndAt)),
    recentEntries: normalizedEntries.slice(0, 12)
  };
};
