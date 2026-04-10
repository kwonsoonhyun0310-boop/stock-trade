import { useMemo, useState } from "react";
import type { ProfitLedgerChartPoint, ProfitLedgerRangeCode, ProfitLedgerRangeSummary } from "@trade/shared";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

interface ProfitLedgerChartProps {
  ranges: ProfitLedgerRangeSummary[];
}

const usdCurrency = new Intl.NumberFormat("en-US", {
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

const tabPriority: ProfitLedgerRangeCode[] = ["1d", "7d", "14d", "30d", "6m", "1y"];

const formatAxisDate = (rangeCode: ProfitLedgerRangeCode, at: number) => {
  const value = new Date(at);

  if (Number.isNaN(value.getTime())) {
    return "";
  }

  if (rangeCode === "1d") {
    return timeFormatter.format(value);
  }

  if (rangeCode === "6m" || rangeCode === "1y") {
    return monthFormatter.format(value);
  }

  return dayFormatter.format(value);
};

const renderAxisTick = (
  props: {
    x?: string | number;
    y?: string | number;
    payload?: { value: number };
  },
  rangeCode: ProfitLedgerRangeCode
) => {
  const timestamp = Number(props.payload?.value ?? 0);
  const x = Number(props.x ?? 0);
  const y = Number(props.y ?? 0);
  const label = formatAxisDate(rangeCode, timestamp);

  if (rangeCode !== "1d") {
    return (
      <g transform={`translate(${x},${y})`}>
        <text x={0} y={0} dy={16} textAnchor="middle" fill="#667166" fontSize={12}>
          {label}
        </text>
      </g>
    );
  }

  return (
    <g transform={`translate(${x},${y})`}>
      <text x={0} y={0} dy={12} textAnchor="middle" fill="#667166" fontSize={12}>
        {label}
      </text>
      <text x={0} y={0} dy={28} textAnchor="middle" fill="#8a9387" fontSize={10}>
        {usTimeFormatter.format(new Date(timestamp))}
      </text>
    </g>
  );
};

const tooltipLabelFormatter = (rangeCode: ProfitLedgerRangeCode, at: string) => {
  const value = new Date(at);

  if (Number.isNaN(value.getTime())) {
    return at;
  }

  if (rangeCode === "1d") {
    return value.toLocaleString("ko-KR", {
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  return value.toLocaleString("ko-KR", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
};

const normalizeChartData = (chart: ProfitLedgerChartPoint[]) =>
  chart.map((point) => ({
    ...point,
    timestamp: new Date(point.at).getTime()
  }));

const tooltipValueFormatter = (
  value: number | string | Array<number | string> | ReadonlyArray<number | string> | undefined
) => {
  const resolvedValue = Array.isArray(value) ? Number(value[0]) : Number(value ?? 0);
  return Number.isFinite(resolvedValue) ? usdCurrency.format(resolvedValue) : usdCurrency.format(0);
};

export function ProfitLedgerChart({ ranges }: ProfitLedgerChartProps) {
  const [activeRangeCode, setActiveRangeCode] = useState<ProfitLedgerRangeCode>("30d");
  const orderedRanges = useMemo(
    () =>
      [...ranges].sort(
        (left, right) => tabPriority.indexOf(left.code) - tabPriority.indexOf(right.code)
      ),
    [ranges]
  );
  const activeRange =
    orderedRanges.find((range) => range.code === activeRangeCode) ?? orderedRanges[0] ?? null;
  const data = activeRange ? normalizeChartData(activeRange.chart) : [];

  if (!activeRange) {
    return null;
  }

  return (
    <section className="price-trend-card">
      <div className="price-trend-header">
        <strong>실현 손익 추이</strong>
        <span>원하는 기간 버튼을 누르면 그 범위만 바로 바뀝니다.</span>
      </div>

      <div className="price-trend-controls" role="tablist" aria-label="실현 손익 기간 선택">
        {orderedRanges.map((range) => (
          <button
            key={range.code}
            type="button"
            role="tab"
            aria-selected={range.code === activeRange.code}
            className={`price-range-button ${range.code === activeRange.code ? "active" : ""}`}
            onClick={() => setActiveRangeCode(range.code)}
          >
            {range.label}
          </button>
        ))}
      </div>

      <div className="price-trend-header">
        <strong>{activeRange.label} 누적 수익 {usdCurrency.format(activeRange.realizedProfitUsd)}</strong>
        <span>{activeRange.tradeCount}건 매도 체결이 그래프에 반영됩니다.</span>
      </div>

      <div className="price-trend-chart">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 12, right: 14, bottom: activeRange.code === "1d" ? 18 : 8, left: 0 }}>
            <CartesianGrid stroke="rgba(30, 42, 35, 0.08)" vertical={false} />
            <ReferenceLine y={0} stroke="rgba(30, 42, 35, 0.18)" />
            <XAxis
              type="number"
              dataKey="timestamp"
              scale="time"
              domain={["dataMin", "dataMax"]}
              minTickGap={24}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
              tick={(props) => renderAxisTick(props, activeRange.code)}
              height={activeRange.code === "1d" ? 42 : 24}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={84}
              tickFormatter={(value: number) => usdCurrency.format(value)}
            />
            <Tooltip
              formatter={(value, name) => [
                tooltipValueFormatter(value),
                name === "cumulativeProfitUsd" ? "누적 수익" : "체결 수익"
              ]}
              labelFormatter={(value) => tooltipLabelFormatter(activeRange.code, String(value))}
              contentStyle={{
                borderRadius: "16px",
                border: "1px solid rgba(30, 42, 35, 0.08)",
                boxShadow: "0 18px 40px rgba(45, 39, 24, 0.14)"
              }}
            />
            <Line
              type="monotone"
              dataKey="cumulativeProfitUsd"
              stroke="#cf6a32"
              strokeWidth={3}
              dot={{ r: 3, strokeWidth: 0, fill: "#cf6a32" }}
              activeDot={{ r: 5 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      {activeRange.code === "1d" ? (
        <p className="price-trend-note">위는 한국시간, 아래는 미국 동부시간입니다.</p>
      ) : null}
      <p className="price-trend-note">선이 위로 갈수록 누적 실현 손익이 커지고, 아래로 갈수록 줄어듭니다.</p>
    </section>
  );
}
