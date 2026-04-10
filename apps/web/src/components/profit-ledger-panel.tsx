import type { ProfitLedgerSnapshot } from "@trade/shared";
import { ProfitLedgerChart } from "./profit-ledger-chart.js";

interface ProfitLedgerPanelProps {
  ledger: ProfitLedgerSnapshot;
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

const getCostBasisLabel = (mode: ProfitLedgerSnapshot["recentEntries"][number]["costBasisMode"]) =>
  mode === "exact_fifo" ? "정확 매칭" : "추정 포함";

export function ProfitLedgerPanel({ ledger }: ProfitLedgerPanelProps) {
  return (
    <section className="panel profit-ledger-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Profit Ledger</p>
          <h2>실현 손익 장부</h2>
          <p className="empty-state compact-empty-state">
            한국투자증권 해외주식 체결내역을 기준으로 FIFO로 맞춘 장부입니다. 오래된 매수 lot이 조회 구간 밖이면 해당 수량은 추정 포함으로 표시합니다.
          </p>
        </div>
        <div className="ledger-header-meta">
          <span>누적 수익 {usdCurrency.format(ledger.totalRealizedProfitUsd)}</span>
          <span>완료 {ledger.totalTradeCount}건</span>
          <span>정확 매칭 {ledger.exactTradeCount}건</span>
          <span>추정 포함 {ledger.estimatedTradeCount}건</span>
          <span>마지막 집계 {new Date(ledger.updatedAt).toLocaleString()}</span>
        </div>
      </div>

      <div className="ledger-period-grid">
        {ledger.ranges.map((range) => (
          <article key={range.code} className="ledger-period-card">
            <span>{range.label}</span>
            <strong className={getProfitTone(range.realizedProfitUsd)}>
              {usdCurrency.format(range.realizedProfitUsd)}
            </strong>
            <p>{range.tradeCount}건 매도 체결 기준 누적 수익</p>
          </article>
        ))}
      </div>

      <ProfitLedgerChart ranges={ledger.ranges} />

      {ledger.recentEntries.length === 0 ? (
        <p className="empty-state">아직 불러온 실현 손익 장부가 없습니다.</p>
      ) : (
        <div className="table-shell">
          <table className="holdings-table ledger-table">
            <thead>
              <tr>
                <th>완료 시각</th>
                <th>종목</th>
                <th>수량</th>
                <th>매수가</th>
                <th>매도가</th>
                <th>계산 방식</th>
                <th>실현 수익</th>
              </tr>
            </thead>
            <tbody>
              {ledger.recentEntries.map((entry) => (
                <tr key={entry.id}>
                  <td>{new Date(entry.completedAt).toLocaleString()}</td>
                  <td>
                    <strong>{entry.symbol}</strong>
                    <span>{entry.exchange}</span>
                  </td>
                  <td>{entry.quantity.toFixed(0)}주</td>
                  <td>{usdCurrency.format(entry.entryPrice)}</td>
                  <td>{usdCurrency.format(entry.exitPrice)}</td>
                  <td>
                    <strong>{getCostBasisLabel(entry.costBasisMode)}</strong>
                    <span>
                      {entry.costBasisMode === "exact_fifo"
                        ? `${entry.matchedQuantity.toFixed(0)}주 전량 매칭`
                        : `${entry.matchedQuantity.toFixed(0)}주 매칭 / ${entry.estimatedQuantity.toFixed(0)}주 추정`}
                    </span>
                  </td>
                  <td className={entry.realizedProfitUsd >= 0 ? "profit-up" : "profit-down"}>
                    <strong>{usdCurrency.format(entry.realizedProfitUsd)}</strong>
                    <span>{percentFormat.format(entry.realizedProfitPercent)}%</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
