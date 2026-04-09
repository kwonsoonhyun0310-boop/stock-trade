import { useState } from "react";
import type { ExchangeCode, ManualOrderRequest, ManualOrderResponse } from "@trade/shared";

interface TradeTicketProps {
  onSubmit: (order: ManualOrderRequest) => Promise<ManualOrderResponse>;
}

export function TradeTicket({ onSubmit }: TradeTicketProps) {
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [symbol, setSymbol] = useState("AAPL");
  const [exchange, setExchange] = useState<ExchangeCode>("NASD");
  const [quantity, setQuantity] = useState(1);
  const [limitPrice, setLimitPrice] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setSubmitting(true);
    setMessage(null);
    setError(null);

    try {
      const result = await onSubmit({
        side,
        symbol: symbol.trim().toUpperCase(),
        exchange,
        quantity,
        limitPrice
      });
      setMessage(`${result.message} 주문번호: ${result.orderNumber ?? "-"}`);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "주문 실패");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="panel action-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Trade Ticket</p>
          <h2>미국주식 수동 매매</h2>
        </div>
      </div>

      <div className="segmented">
        <button
          className={side === "buy" ? "segment active" : "segment"}
          onClick={() => setSide("buy")}
        >
          매수
        </button>
        <button
          className={side === "sell" ? "segment active" : "segment"}
          onClick={() => setSide("sell")}
        >
          매도
        </button>
      </div>

      <div className="form-grid">
        <label>
          <span>종목코드</span>
          <input value={symbol} onChange={(event) => setSymbol(event.target.value)} />
        </label>

        <label>
          <span>거래소</span>
          <select value={exchange} onChange={(event) => setExchange(event.target.value as ExchangeCode)}>
            <option value="NASD">NASDAQ</option>
            <option value="NYSE">NYSE</option>
            <option value="AMEX">AMEX</option>
          </select>
        </label>

        <label>
          <span>수량</span>
          <input
            type="number"
            min={1}
            step={1}
            value={quantity}
            onChange={(event) => setQuantity(Number(event.target.value))}
          />
        </label>

        <label>
          <span>지정가(USD)</span>
          <input
            type="number"
            min={0.01}
            step={0.01}
            value={limitPrice}
            onChange={(event) => setLimitPrice(Number(event.target.value))}
          />
        </label>
      </div>

      <div className="panel-footer">
        <div className="status-block">
          <strong>{side === "buy" ? "수동 매수 주문" : "수동 매도 주문"}</strong>
          <span>실전 계좌로 바로 접수됩니다. 가격과 수량을 다시 확인하세요.</span>
        </div>
        <button className="primary-button" onClick={() => void submit()} disabled={submitting || limitPrice <= 0}>
          {submitting ? "접수 중" : side === "buy" ? "매수 주문" : "매도 주문"}
        </button>
      </div>

      {message ? <p className="success-text">{message}</p> : null}
      {error ? <p className="error-text">{error}</p> : null}
    </section>
  );
}
