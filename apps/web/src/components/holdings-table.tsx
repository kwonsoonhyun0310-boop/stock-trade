import type { HoldingSnapshot } from "@trade/shared";

interface HoldingsTableProps {
  holdings: HoldingSnapshot[];
}

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2
});

export function HoldingsTable({ holdings }: HoldingsTableProps) {
  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Live Holdings</p>
          <h2>미국주식 보유 현황</h2>
        </div>
      </div>

      {holdings.length === 0 ? (
        <p className="empty-state">설정된 계좌 정보가 없거나 현재 조회된 미국 보유 종목이 없습니다.</p>
      ) : (
        <div className="table-shell">
          <table className="holdings-table">
            <thead>
              <tr>
                <th>종목</th>
                <th>수량</th>
                <th>평균가</th>
                <th>현재가</th>
                <th>수익률</th>
                <th>주문가능</th>
              </tr>
            </thead>
            <tbody>
              {holdings.map((holding) => (
                <tr key={`${holding.exchange}-${holding.symbol}`}>
                  <td>
                    <strong>{holding.symbol}</strong>
                    <span>{holding.exchange}</span>
                  </td>
                  <td>{holding.quantity.toFixed(0)}</td>
                  <td>{currency.format(holding.averagePrice)}</td>
                  <td>{currency.format(holding.currentPrice)}</td>
                  <td className={holding.profitPercent >= 0 ? "profit-up" : "profit-down"}>
                    {holding.profitPercent.toFixed(2)}%
                  </td>
                  <td>{holding.orderableQuantity.toFixed(0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
