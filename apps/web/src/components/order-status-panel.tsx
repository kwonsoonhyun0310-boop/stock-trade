import type { AutoSellEvent, AutoSellTarget, TradingOrderQueueItem, TradingStatus } from "@trade/shared";

interface OrderStatusPanelProps {
  trading: TradingStatus;
}

const getBuyOrderStatusLabel = (status: AutoSellTarget["buyOrderStatus"]) => {
  switch (status) {
    case "submitted":
      return "접수됨";
    case "partially_filled":
      return "부분 체결";
    case "filled":
      return "전량 체결";
    case "cancelled":
      return "매수 취소됨";
    case "rejected":
      return "거부됨";
    default:
      return "확인 중";
  }
};

const getEventStatusLabel = (status: AutoSellEvent["status"]) => {
  switch (status) {
    case "submitted":
      return "주문 접수";
    case "completed":
      return "체결 완료";
    case "failed":
      return "실패";
    case "cancelled":
      return "취소됨";
    default:
      return "대기";
  }
};

const getStatusTone = (status: AutoSellTarget["buyOrderStatus"] | AutoSellEvent["status"]) => {
  switch (status) {
    case "filled":
    case "completed":
      return "completed";
    case "partially_filled":
    case "submitted":
      return "submitted";
    case "failed":
    case "rejected":
      return "failed";
    case "cancelled":
      return "cancelled";
    default:
      return "pending";
  }
};

const getQueueStatusLabel = (status: TradingOrderQueueItem["status"]) => {
  switch (status) {
    case "running":
      return "전송 중";
    case "retry_wait":
      return "재시도 대기";
    case "blocked":
      return "재시도 중단";
    default:
      return "대기열";
  }
};

const getQueueKindLabel = (kind: TradingOrderQueueItem["kind"]) => {
  switch (kind) {
    case "one_click_buy":
      return "원클릭 매수";
    case "buy_modify":
      return "매수 정정";
    case "buy_cancel":
      return "매수 취소";
    default:
      return "자동매도";
  }
};

const getQueueStatusTone = (status: TradingOrderQueueItem["status"]) => {
  switch (status) {
    case "running":
      return "submitted";
    case "retry_wait":
      return "pending";
    case "blocked":
      return "failed";
    default:
      return "pending";
  }
};

const toSellOrderSnapshot = (events: AutoSellEvent[]) => {
  const latestByKey = new Map<string, AutoSellEvent>();

  for (const event of events) {
    if (!event.reason.includes("자동매도")) {
      continue;
    }

    const key = event.orderNumber || event.id;
    const current = latestByKey.get(key);

    if (!current || current.createdAt < event.createdAt) {
      latestByKey.set(key, event);
    }
  }

  return [...latestByKey.values()].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
};

export function OrderStatusPanel({ trading }: OrderStatusPanelProps) {
  const buyTargets = trading.autoSellTargets
    .filter((target) => Boolean(target.buyOrderNumber))
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  const sellOrders = toSellOrderSnapshot(trading.recentEvents);
  const queuedOrders = [...trading.orderQueue].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Order Status</p>
          <h2>주문 상태</h2>
        </div>
      </div>

      <div className="order-status-layout">
        <section className="order-status-section">
          <div className="order-status-section-header">
            <strong>매수 주문 상태</strong>
            <span>원클릭 매수로 접수한 주문 상태를 보여줍니다.</span>
          </div>

          {buyTargets.length === 0 ? (
            <p className="empty-state compact-empty-state">아직 조회할 매수 주문이 없습니다.</p>
          ) : (
            <ul className="order-status-list">
              {buyTargets.map((target) => (
                <li key={target.id} className="order-status-card">
                  <div className="order-status-header">
                    <strong>
                      {target.symbol} / {target.exchange}
                    </strong>
                    <span className={`order-status-pill ${getStatusTone(target.buyOrderStatus)}`}>
                      {getBuyOrderStatusLabel(target.buyOrderStatus)}
                    </span>
                  </div>
                  <div className="order-status-meta">
                    <span>주문번호 {target.buyOrderNumber}</span>
                    <span>등록수량 {target.requestedQuantity.toFixed(0)}주</span>
                    <span>체결수량 {target.buyFilledQuantity.toFixed(0)}주</span>
                    <span>미체결수량 {target.buyOpenQuantity.toFixed(0)}주</span>
                    <span>자동매도 남은수량 {target.remainingQuantity.toFixed(0)}주</span>
                    <span>최근 확인 {target.buyOrderUpdatedAt ? new Date(target.buyOrderUpdatedAt).toLocaleString() : "아직 없음"}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="order-status-section">
          <div className="order-status-section-header">
            <strong>주문 재시도 큐</strong>
            <span>자동매도 주문 실패 시 여기서 재시도 대기와 중복 차단 상태를 확인합니다.</span>
          </div>

          {queuedOrders.length === 0 ? (
            <p className="empty-state compact-empty-state">현재 재시도 중인 자동매도 주문이 없습니다.</p>
          ) : (
            <ul className="order-status-list">
              {queuedOrders.map((item) => (
                <li key={item.id} className="order-status-card">
                  <div className="order-status-header">
                    <strong>
                      {item.symbol} / {item.exchange}
                    </strong>
                    <span className={`order-status-pill ${getQueueStatusTone(item.status)}`}>
                      {getQueueStatusLabel(item.status)}
                    </span>
                  </div>
                  <div className="order-status-meta">
                    <span>작업 {getQueueKindLabel(item.kind)}</span>
                    <span>대상수량 {item.quantity.toFixed(0)}주</span>
                    <span>주문가 {item.limitPrice.toFixed(2)} USD</span>
                    <span>시도횟수 {item.attemptCount}회</span>
                    <span>다음 시도 {new Date(item.nextAttemptAt).toLocaleString()}</span>
                    {item.lastAttemptAt ? <span>최근 시도 {new Date(item.lastAttemptAt).toLocaleString()}</span> : null}
                    {item.lastError ? <span>{item.lastError}</span> : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="order-status-section">
          <div className="order-status-section-header">
            <strong>자동매도 주문 상태</strong>
            <span>목표 수익률 도달 후 자동으로 나간 매도 주문의 최근 상태입니다.</span>
          </div>

          {sellOrders.length === 0 ? (
            <p className="empty-state compact-empty-state">아직 자동매도 주문 이력이 없습니다.</p>
          ) : (
            <ul className="order-status-list">
              {sellOrders.map((event) => (
                <li key={event.orderNumber || event.id} className="order-status-card">
                  <div className="order-status-header">
                    <strong>
                      {event.symbol} / {event.exchange}
                    </strong>
                    <span className={`order-status-pill ${getStatusTone(event.status)}`}>
                      {getEventStatusLabel(event.status)}
                    </span>
                  </div>
                  <div className="order-status-meta">
                    <span>주문번호 {event.orderNumber || "없음"}</span>
                    <span>주문수량 {event.quantity.toFixed(0)}주</span>
                    <span>주문가 {event.orderPrice.toFixed(2)} USD</span>
                    <span>발생시각 {new Date(event.createdAt).toLocaleString()}</span>
                    <span>{event.reason}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </section>
  );
}
