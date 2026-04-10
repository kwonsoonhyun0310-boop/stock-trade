import type { ExchangeCode, OneClickBuyPrecheckResponse } from "@trade/shared";

interface BuyConfirmDialogProps {
  symbol: string;
  name: string;
  exchange: ExchangeCode;
  quantity: number;
  limitPrice: number;
  usdKrwRate: number;
  precheck: OneClickBuyPrecheckResponse | null;
  targetProfitPercent: number;
  targetPrice: number;
  submitting: boolean;
  errorMessage?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

const usdCurrency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2
});

const krwCurrency = new Intl.NumberFormat("ko-KR", {
  style: "currency",
  currency: "KRW",
  maximumFractionDigits: 0
});

const exchangeLabel = (exchange: ExchangeCode) => {
  switch (exchange) {
    case "NASD":
      return "NASDAQ";
    case "NYSE":
      return "NYSE";
    case "AMEX":
      return "AMEX";
  }
};

const getCheckTone = (status: OneClickBuyPrecheckResponse["checks"][number]["status"]) => {
  switch (status) {
    case "pass":
      return "pass";
    case "warn":
      return "warn";
    default:
      return "fail";
  }
};

const getCheckLabel = (status: OneClickBuyPrecheckResponse["checks"][number]["status"]) => {
  switch (status) {
    case "pass":
      return "정상";
    case "warn":
      return "주의";
    default:
      return "실패";
  }
};

export function BuyConfirmDialog({
  symbol,
  name,
  exchange,
  quantity,
  limitPrice,
  usdKrwRate,
  precheck,
  targetProfitPercent,
  targetPrice,
  submitting,
  errorMessage,
  onConfirm,
  onCancel
}: BuyConfirmDialogProps) {
  const hasFxRate = usdKrwRate > 0;
  const isReadyToSubmit = precheck?.ready ?? false;
  const perShareKrw = usdKrwRate > 0 ? limitPrice * usdKrwRate : 0;
  const totalOrderKrw = usdKrwRate > 0 ? limitPrice * quantity * usdKrwRate : 0;
  const targetPriceKrw = usdKrwRate > 0 ? targetPrice * usdKrwRate : 0;

  return (
    <div
      className="confirm-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="buy-confirm-title"
      onClick={onCancel}
    >
      <div className="confirm-dialog" onClick={(event) => event.stopPropagation()}>
        <div className="confirm-header">
          <p className="eyebrow">Confirm Buy</p>
          <h3 id="buy-confirm-title">매수하시겠습니까?</h3>
        </div>

        <div className="confirm-summary-card">
          <strong>{symbol}</strong>
          <span>
            {name} · {exchangeLabel(exchange)}
          </span>
        </div>

        <div className="confirm-grid">
          <div className="confirm-item">
            <span>매수 수량</span>
            <strong>{quantity.toFixed(0)}주</strong>
          </div>
          <div className="confirm-item">
            <span>매수가</span>
            <strong>
              {hasFxRate
                ? `${usdCurrency.format(limitPrice)} / ${krwCurrency.format(perShareKrw)}`
                : `${usdCurrency.format(limitPrice)} / 환율 불러오는 중`}
            </strong>
          </div>
          <div className="confirm-item">
            <span>예상 주문 금액</span>
            <strong>
              {hasFxRate
                ? `${usdCurrency.format(limitPrice * quantity)} / ${krwCurrency.format(totalOrderKrw)}`
                : `${usdCurrency.format(limitPrice * quantity)} / 환율 불러오는 중`}
            </strong>
          </div>
          <div className="confirm-item">
            <span>자동매도 목표가</span>
            <strong>
              {hasFxRate
                ? `${usdCurrency.format(targetPrice)} / ${krwCurrency.format(targetPriceKrw)}`
                : `${usdCurrency.format(targetPrice)} / 환율 불러오는 중`}
            </strong>
          </div>
        </div>

        <p className="confirm-note">
          이 주문이 접수되면 같은 수량이 {targetProfitPercent.toFixed(2)}% 이익 구간에서 자동매도 대상으로 등록됩니다.
        </p>

        {precheck ? (
          <div className="precheck-box">
            <div className="precheck-header">
              <strong>주문 전 사전체크</strong>
              <span>{new Date(precheck.checkedAt).toLocaleString()} 기준</span>
            </div>
            <ul className="precheck-list">
              {precheck.checks.map((check) => (
                <li key={check.code} className="precheck-item">
                  <div className="precheck-item-header">
                    <strong>{check.title}</strong>
                    <span className={`precheck-pill ${getCheckTone(check.status)}`}>
                      {getCheckLabel(check.status)}
                    </span>
                  </div>
                  <p>{check.detail}</p>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {errorMessage ? <p className="error-text confirm-error-text">{errorMessage}</p> : null}

        <div className="confirm-actions">
          <button type="button" className="ghost-button" onClick={onCancel} disabled={submitting}>
            취소
          </button>
          <button
            type="button"
            className="primary-button"
            onClick={onConfirm}
            disabled={submitting || !isReadyToSubmit}
          >
            {submitting ? "주문 접수 중" : isReadyToSubmit ? "네, 매수합니다" : "사전체크 통과 필요"}
          </button>
        </div>
      </div>
    </div>
  );
}
