import type { AutoSellEvent } from "@trade/shared";

interface EventsListProps {
  events: AutoSellEvent[];
}

export function EventsList({ events }: EventsListProps) {
  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Execution Log</p>
          <h2>자동매도 이벤트</h2>
        </div>
      </div>

      {events.length === 0 ? (
        <p className="empty-state">아직 자동매도 이벤트가 없습니다.</p>
      ) : (
        <ul className="event-list">
          {events.map((event) => (
            <li key={event.id} className={`event-card event-${event.status}`}>
              <div>
                <strong>
                  {event.symbol} / {event.exchange}
                </strong>
                <span>{new Date(event.createdAt).toLocaleString()}</span>
              </div>
              <p>{event.reason}</p>
              <div className="event-meta">
                <span>수익률 {event.triggerProfitPercent.toFixed(2)}%</span>
                <span>주문수량 {event.quantity.toFixed(0)}</span>
                <span>주문가 {event.orderPrice.toFixed(2)}</span>
                {event.orderNumber ? <span>주문번호 {event.orderNumber}</span> : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
