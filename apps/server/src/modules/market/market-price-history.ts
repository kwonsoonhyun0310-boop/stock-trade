import type { PriceHistoryPoint } from "@trade/shared";

interface ChartQuotePoint {
  date?: Date | string;
  close?: number | null;
}

export interface NormalizedClosePoint {
  date: Date;
  close: number;
}

const dayFormatter = new Intl.DateTimeFormat("ko-KR", {
  month: "numeric",
  day: "numeric"
});

const monthFormatter = new Intl.DateTimeFormat("ko-KR", {
  year: "2-digit",
  month: "numeric"
});

const timeFormatter = new Intl.DateTimeFormat("ko-KR", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false
});

const intradayLabelFormatter = new Intl.DateTimeFormat("ko-KR", {
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false
});

const dateKeyFormatter = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
});

const toDateKey = (value: Date) => dateKeyFormatter.format(value);

const toHistoricalPrice = (currentPrice: number, returnPercent: number) => {
  const multiplier = 1 + returnPercent / 100;
  return multiplier > 0 ? currentPrice / multiplier : currentPrice;
};

const toPoint = (
  date: Date,
  price: number,
  kind: PriceHistoryPoint["kind"],
  label: string
): PriceHistoryPoint => ({
  date: date.toISOString(),
  label,
  price: Number(price.toFixed(2)),
  kind
});

export const normalizeQuotes = (quotes: ChartQuotePoint[]): NormalizedClosePoint[] => {
  const byDay = new Map<string, NormalizedClosePoint>();

  for (const quote of quotes) {
    const date = quote.date instanceof Date ? quote.date : quote.date ? new Date(quote.date) : undefined;
    const close = quote.close;

    if (!date || !Number.isFinite(date.getTime()) || typeof close !== "number" || !Number.isFinite(close)) {
      continue;
    }

    byDay.set(toDateKey(date), { date, close });
  }

  return [...byDay.values()].sort((left, right) => left.date.getTime() - right.date.getTime());
};

export const normalizeIntradayQuotes = (quotes: ChartQuotePoint[]): NormalizedClosePoint[] => {
  const byMinute = new Map<string, NormalizedClosePoint>();

  for (const quote of quotes) {
    const date = quote.date instanceof Date ? quote.date : quote.date ? new Date(quote.date) : undefined;
    const close = quote.close;

    if (!date || !Number.isFinite(date.getTime()) || typeof close !== "number" || !Number.isFinite(close)) {
      continue;
    }

    byMinute.set(date.toISOString().slice(0, 16), { date, close });
  }

  return [...byMinute.values()].sort((left, right) => left.date.getTime() - right.date.getTime());
};

const aggregateSeriesByMinutes = (
  series: NormalizedClosePoint[],
  minutes: number
): NormalizedClosePoint[] => {
  const bucketMs = minutes * 60 * 1000;
  const buckets = new Map<number, NormalizedClosePoint>();

  for (const point of series) {
    const bucketStart = Math.floor(point.date.getTime() / bucketMs) * bucketMs;
    buckets.set(bucketStart, {
      date: new Date(bucketStart),
      close: point.close
    });
  }

  return [...buckets.values()].sort((left, right) => left.date.getTime() - right.date.getTime());
};

const finalizeWithCurrentPoint = (
  points: PriceHistoryPoint[],
  currentPrice: number,
  currentLabel = "현재"
): PriceHistoryPoint[] => {
  const now = new Date();
  const lastPoint = points.at(-1);

  if (!lastPoint) {
    return [];
  }

  if (
    toDateKey(new Date(lastPoint.date)) === toDateKey(now) &&
    Math.abs(lastPoint.price - currentPrice) < 0.01
  ) {
    points[points.length - 1] = toPoint(now, currentPrice, "current", currentLabel);
    return points;
  }

  points.push(toPoint(now, currentPrice, "current", currentLabel));
  return points;
};

export const buildFallbackPriceHistory = (
  currentPrice: number,
  oneMonthReturn: number,
  threeMonthReturn: number
): PriceHistoryPoint[] => {
  if (!Number.isFinite(currentPrice) || currentPrice <= 0) {
    return [];
  }

  const now = new Date();
  const oneMonthDate = new Date(now);
  const threeMonthDate = new Date(now);

  oneMonthDate.setDate(oneMonthDate.getDate() - 30);
  threeMonthDate.setDate(threeMonthDate.getDate() - 90);

  return [
    toPoint(
      threeMonthDate,
      toHistoricalPrice(currentPrice, threeMonthReturn),
      "three_months_ago",
      "3달 전"
    ),
    toPoint(
      oneMonthDate,
      toHistoricalPrice(currentPrice, oneMonthReturn),
      "recent_daily",
      "1달 전"
    ),
    toPoint(now, currentPrice, "current", "현재")
  ];
};

export const buildPriceHistory = (
  series: NormalizedClosePoint[],
  currentPrice: number,
  oneMonthReturn: number,
  threeMonthReturn: number
): PriceHistoryPoint[] => {
  if (series.length === 0) {
    return buildFallbackPriceHistory(currentPrice, oneMonthReturn, threeMonthReturn);
  }

  const points = series.map((quote, index) =>
    toPoint(
      quote.date,
      quote.close,
      index === 0 ? "three_months_ago" : "recent_daily",
      index === 0 ? "3달 전" : dayFormatter.format(quote.date)
    )
  );

  return finalizeWithCurrentPoint(points, currentPrice);
};

export const buildFallbackExtendedPriceHistory = (
  currentPrice: number,
  oneMonthReturn: number,
  threeMonthReturn: number
) => buildFallbackPriceHistory(currentPrice, oneMonthReturn, threeMonthReturn);

export const buildExtendedPriceHistory = (
  series: NormalizedClosePoint[],
  currentPrice: number,
  oneMonthReturn: number,
  threeMonthReturn: number
): PriceHistoryPoint[] => {
  if (series.length === 0) {
    return buildFallbackExtendedPriceHistory(currentPrice, oneMonthReturn, threeMonthReturn);
  }

  const points = series.map((quote, index) =>
    toPoint(
      quote.date,
      quote.close,
      index === 0 ? "three_months_ago" : "recent_daily",
      index === 0 ? "3년 전" : monthFormatter.format(quote.date)
    )
  );

  return finalizeWithCurrentPoint(points, currentPrice);
};

export const buildFallbackIntradayPriceHistory = (currentPrice: number): PriceHistoryPoint[] => {
  if (!Number.isFinite(currentPrice) || currentPrice <= 0) {
    return [];
  }

  const now = new Date();
  const start = new Date(now.getTime() - 30 * 60 * 1000);

  return [
    toPoint(start, currentPrice, "recent_daily", "30분 전"),
    toPoint(now, currentPrice, "current", "현재")
  ];
};

export const buildIntradayPriceHistory = (
  series: NormalizedClosePoint[],
  currentPrice: number
): PriceHistoryPoint[] => {
  if (series.length === 0) {
    return buildFallbackIntradayPriceHistory(currentPrice);
  }

  const aggregatedSeries = aggregateSeriesByMinutes(series, 30);
  const trimmedSeries = aggregatedSeries.slice(Math.max(0, aggregatedSeries.length - 14));
  const points = trimmedSeries.map((quote, index) =>
    toPoint(
      quote.date,
      quote.close,
      index === trimmedSeries.length - 1 ? "current" : "recent_daily",
      index === 0 ? "30분 간격 시작" : intradayLabelFormatter.format(quote.date)
    )
  );

  return finalizeWithCurrentPoint(points, currentPrice);
};
