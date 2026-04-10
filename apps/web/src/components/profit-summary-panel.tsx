import type { TradingStatus } from "@trade/shared";
import { deriveProfitSummary } from "../lib/profit-summary.js";

interface ProfitSummaryPanelProps {
  trading: TradingStatus;
}

const usdCurrency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2
});

const percentFormat = new Intl.NumberFormat("ko-KR", {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2
});

const getProfitTone = (value: number) =>
  value > 0 ? "profit-positive" : value < 0 ? "profit-negative" : "profit-neutral";

export function ProfitSummaryPanel({ trading }: ProfitSummaryPanelProps) {
  const summary = deriveProfitSummary(trading);

  return (
    <section className="summary-grid">
      <article className="summary-card">
        <span>현재 평가 손익</span>
        <strong className={getProfitTone(summary.unrealizedProfitUsd)}>
          {usdCurrency.format(summary.unrealizedProfitUsd)}
        </strong>
        <p>지금 보유 중인 미국주식 기준 평가 손익입니다.</p>
      </article>
      <article className="summary-card">
        <span>총 평가 금액</span>
        <strong>{usdCurrency.format(summary.evaluatedAmountUsd)}</strong>
        <p>현재 계좌에 잡혀 있는 해외주식 평가금액 합계입니다.</p>
      </article>
      <article className="summary-card">
        <span>계좌 현금</span>
        <strong>{usdCurrency.format(trading.accountSummary.orderableCashUsd)}</strong>
        <p>지금 미국주식 주문에 바로 사용할 수 있는 달러 현금입니다.</p>
      </article>
      <article className="summary-card">
        <span>보유 평균 수익률</span>
        <strong className={getProfitTone(summary.weightedProfitPercent)}>
          {percentFormat.format(summary.weightedProfitPercent)}%
        </strong>
        <p>현재 보유 종목들의 원가 대비 평균 손익률입니다.</p>
      </article>
    </section>
  );
}
