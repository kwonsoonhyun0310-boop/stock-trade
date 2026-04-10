import { useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import type { PriceHistoryPoint } from "@trade/shared";

interface PriceTrendChartProps {
  points: PriceHistoryPoint[];
  extendedPoints: PriceHistoryPoint[];
  intradayPoints: PriceHistoryPoint[];
  metricLabel?: string;
}

type RangeKey = "30m" | "1w" | "1m" | "3m" | "6m" | "1y" | "3y";

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2
});

const dayFormatter = new Intl.DateTimeFormat("ko-KR", {
  month: "numeric",
  day: "numeric"
});

const monthFormatter = new Intl.DateTimeFormat("ko-KR", {
  year: "2-digit",
  month: "numeric"
});

const usMarketClockFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  weekday: "short",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false
});

const usDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/New_York",
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
});

const koreaDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
});

const koreaTimeFormatter = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false
});

const timeFormatter = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false
});

const usTimeFormatter = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "America/New_York",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false
});

const RANGE_LABELS: Record<RangeKey, string> = {
  "30m": "30분",
  "1w": "1주",
  "1m": "1개월",
  "3m": "3개월",
  "6m": "6개월",
  "1y": "1년",
  "3y": "3년"
};

const RANGE_COUNTS: Record<"1w" | "1m" | "6m" | "1y", number> = {
  "1w": 7,
  "1m": 23,
  "6m": 27,
  "1y": 53
};

const formatAxisDate = (value: number, range: RangeKey) => {
  const date = new Date(value);

  if (range === "30m") {
    return timeFormatter.format(date);
  }

  if (range === "1y" || range === "3y") {
    return monthFormatter.format(date);
  }

  return dayFormatter.format(date);
};

const renderAxisTick = (
  props: {
    x?: string | number;
    y?: string | number;
    payload?: { value: number };
  },
  range: RangeKey
) => {
  const timestamp = Number(props.payload?.value ?? 0);
  const x = Number(props.x ?? 0);
  const y = Number(props.y ?? 0);
  const primaryLabel = formatAxisDate(timestamp, range);

  if (range !== "30m") {
    return (
      <g transform={`translate(${x},${y})`}>
        <text
          x={0}
          y={0}
          dy={16}
          textAnchor="middle"
          fill="#667166"
          fontSize={12}
        >
          {primaryLabel}
        </text>
      </g>
    );
  }

  return (
    <g transform={`translate(${x},${y})`}>
      <text
        x={0}
        y={0}
        dy={12}
        textAnchor="middle"
        fill="#667166"
        fontSize={12}
      >
        {primaryLabel}
      </text>
      <text
        x={0}
        y={0}
        dy={28}
        textAnchor="middle"
        fill="#8a9387"
        fontSize={10}
      >
        {usTimeFormatter.format(new Date(timestamp))}
      </text>
    </g>
  );
};

const selectVisiblePoints = (
  range: RangeKey,
  dailyPoints: PriceHistoryPoint[],
  extendedPoints: PriceHistoryPoint[],
  intradayPoints: PriceHistoryPoint[]
) => {
  if (range === "30m") {
    return intradayPoints.length > 1 ? intradayPoints : dailyPoints.slice(-2);
  }

  if (range === "1w" || range === "1m") {
    return dailyPoints.slice(Math.max(0, dailyPoints.length - RANGE_COUNTS[range]));
  }

  if (range === "3m") {
    return dailyPoints;
  }

  if (range === "6m" || range === "1y") {
    return extendedPoints.slice(Math.max(0, extendedPoints.length - RANGE_COUNTS[range]));
  }

  return extendedPoints;
};

const getTimeZoneOffsetMinutes = (date: Date, timeZone: string) => {
  const zone = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName: "shortOffset"
  })
    .formatToParts(date)
    .find((part) => part.type === "timeZoneName")
    ?.value;

  const match = zone?.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);

  if (!match) {
    return 0;
  }

  const sign = match[1] === "-" ? -1 : 1;
  const hours = Number(match[2] ?? 0);
  const minutes = Number(match[3] ?? 0);
  return sign * (hours * 60 + minutes);
};

const buildZonedDate = (dateKey: string, hour: number, minute: number, timeZone: string) => {
  const [year, month, day] = dateKey.split("-").map(Number);
  const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute));
  const offsetMinutes = getTimeZoneOffsetMinutes(utcGuess, timeZone);
  return new Date(Date.UTC(year, month - 1, day, hour, minute) - offsetMinutes * 60_000);
};

const getKoreanMarketUpdateLabel = () => {
  const usDateKey = usDateFormatter.format(new Date());
  const sessionStart = buildZonedDate(usDateKey, 9, 30, "America/New_York");
  const sessionEnd = buildZonedDate(usDateKey, 16, 0, "America/New_York");
  const startDateKey = koreaDateFormatter.format(sessionStart);
  const endDateKey = koreaDateFormatter.format(sessionEnd);
  const startTime = koreaTimeFormatter.format(sessionStart);
  const endTime = koreaTimeFormatter.format(sessionEnd);
  const endLabel = startDateKey === endDateKey ? endTime : `다음날 ${endTime}`;

  return `30분 차트는 한국시간 기준 ${startTime}~${endLabel}에 30분마다 갱신`;
};

const isUsMarketClosedNow = () => {
  const parts = Object.fromEntries(
    usMarketClockFormatter
      .formatToParts(new Date())
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value])
  );

  const weekday = parts.weekday;
  const hour = Number(parts.hour ?? 0);
  const minute = Number(parts.minute ?? 0);
  const totalMinutes = hour * 60 + minute;
  const isWeekday = weekday === "Mon" || weekday === "Tue" || weekday === "Wed" || weekday === "Thu" || weekday === "Fri";

  return !isWeekday || totalMinutes < 4 * 60 || totalMinutes >= 20 * 60;
};

export function PriceTrendChart({
  points,
  extendedPoints,
  intradayPoints,
  metricLabel
}: PriceTrendChartProps) {
  const [range, setRange] = useState<RangeKey>("3m");
  const marketClosed = isUsMarketClosedNow();
  const koreanMarketUpdateLabel = getKoreanMarketUpdateLabel();

  const visiblePoints = selectVisiblePoints(range, points, extendedPoints, intradayPoints);

  if (!Array.isArray(visiblePoints) || visiblePoints.length === 0) {
    return <p className="price-trend-empty">가격 추이를 불러오는 중입니다.</p>;
  }

  const data = visiblePoints.map((point) => ({
    ...point,
    timestamp: new Date(point.date).getTime()
  }));
  const prices = data.map((point) => point.price);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const padding = Math.max((maxPrice - minPrice) * 0.18, maxPrice * 0.03, 1);

  return (
    <div className="price-trend-card">
      <div className="price-trend-header">
        <strong>가격 추이</strong>
        <span>원하는 기간 버튼을 누르면 그 범위만 바로 바뀝니다.</span>
      </div>
      {range === "30m" && marketClosed ? (
        <div className="market-closed-badge">미국장 마감</div>
      ) : null}
      <div className="price-trend-controls" role="tablist" aria-label="가격 추이 범위">
        {(["30m", "1w", "1m", "3m", "6m", "1y", "3y"] as RangeKey[]).map((option) => (
          <button
            key={option}
            type="button"
            className={`price-range-button ${range === option ? "active" : ""}`}
            onClick={() => setRange(option)}
          >
            {RANGE_LABELS[option]}
          </button>
        ))}
      </div>
      <div className="price-trend-chart">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 12, right: 10, bottom: range === "30m" ? 18 : 0, left: 0 }}>
            <CartesianGrid stroke="rgba(30, 42, 35, 0.08)" vertical={false} />
            <XAxis
              type="number"
              dataKey="timestamp"
              scale="time"
              domain={["dataMin", "dataMax"]}
              tickLine={false}
              axisLine={false}
              minTickGap={20}
              interval="preserveStartEnd"
              tick={(props) => renderAxisTick(props, range)}
              height={range === "30m" ? 42 : 24}
            />
            <YAxis
              type="number"
              width={0}
              tick={false}
              tickLine={false}
              axisLine={false}
              domain={[Math.max(0, minPrice - padding), maxPrice + padding]}
            />
            <Tooltip
              formatter={(value) =>
                metricLabel
                  ? `지수 ${Number(value ?? 0).toFixed(1)}`
                  : currency.format(Number(value ?? 0))
              }
              labelFormatter={(_label, payload) => {
                const point = payload?.[0]?.payload as PriceHistoryPoint | undefined;
                return point ? `${point.label} 가격` : "가격";
              }}
              contentStyle={{
                borderRadius: 14,
                border: "1px solid rgba(30, 42, 35, 0.1)",
                background: "rgba(255, 250, 242, 0.96)"
              }}
            />
            <Line
              type="monotone"
              dataKey="price"
              stroke="#cf6a32"
              strokeWidth={3}
              isAnimationActive={false}
              dot={({ cx, cy, payload }) => (
                <circle
                  cx={cx}
                  cy={cy}
                  r={payload.kind === "recent_daily" ? 2.5 : 4}
                  fill={payload.kind === "current" ? "#0f8b63" : "#cf6a32"}
                  stroke="#fff7ec"
                  strokeWidth={2}
                />
              )}
              activeDot={{ r: 5, fill: "#0f8b63", stroke: "#fff7ec", strokeWidth: 2 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      {range === "30m" ? (
        <p className="price-trend-note">위는 한국시간, 아래는 미국 동부시간입니다.</p>
      ) : null}
      <p className="price-trend-note">{koreanMarketUpdateLabel}</p>
    </div>
  );
}
