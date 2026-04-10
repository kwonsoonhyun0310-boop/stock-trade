import { useState } from "react";
import type { AutoSellTarget, TradingStatus } from "@trade/shared";

interface AutoSellPanelProps {
  trading: TradingStatus;
  refreshingDetails: boolean;
  onCancelTarget: (targetId: string) => Promise<void>;
  onModifyBuyOrder: (targetId: string, limitPrice: number) => Promise<void>;
  onCancelBuyOrder: (targetId: string) => Promise<void>;
  onRefreshDetails: () => Promise<void>;
}

const usdCurrency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2
});

const formatShortDateTime = (value?: string) => {
  if (!value) {
    return "아직 점검 없음";
  }

  return new Date(value).toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  });
};

const isBuyOrderEditable = (target: AutoSellTarget) =>
  target.status === "armed" &&
  Boolean(target.buyOrderNumber) &&
  target.buyOpenQuantity > 0 &&
  (target.buyOrderStatus === "submitted" || target.buyOrderStatus === "partially_filled");

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

export function AutoSellPanel({
  trading,
  refreshingDetails,
  onCancelTarget,
  onModifyBuyOrder,
  onCancelBuyOrder,
  onRefreshDetails
}: AutoSellPanelProps) {
  const [cancellingTargetId, setCancellingTargetId] = useState<string | null>(null);
  const [editingTargetId, setEditingTargetId] = useState<string | null>(null);
  const [editingLimitPrice, setEditingLimitPrice] = useState("");
  const [savingBuyOrderActionId, setSavingBuyOrderActionId] = useState<string | null>(null);
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [inlineErrorTargetId, setInlineErrorTargetId] = useState<string | null>(null);
  const activeTargets = trading.autoSellTargets.filter((target) => target.status === "armed");
  const queuedOrderCount = trading.orderQueue.filter((item) => item.status !== "blocked").length;
  const blockedOrderCount = trading.orderQueue.filter((item) => item.status === "blocked").length;
  const pollIntervalSeconds = Math.round(trading.settings.pollIntervalMs / 1000);

  const startEditing = (target: AutoSellTarget) => {
    setEditingTargetId(target.id);
    setEditingLimitPrice(target.entryPrice.toFixed(2));
    setInlineError(null);
    setInlineErrorTargetId(null);
  };

  const stopEditing = () => {
    setEditingTargetId(null);
    setEditingLimitPrice("");
    setInlineError(null);
    setInlineErrorTargetId(null);
  };
  const monitorStatusMessage = trading.lastError || "자동매도 감시 정상 작동 중";

  return (
    <section className="panel action-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Auto Exit Engine</p>
          <h2>5% 자동매도 추적 현황</h2>
        </div>
        <div className="panel-inline-actions">
          <button
            type="button"
            className="ghost-button panel-inline-button"
            disabled={refreshingDetails}
            onClick={() => {
              void onRefreshDetails();
            }}
          >
            {refreshingDetails ? "상세 확인 중" : "계좌 상세 다시 확인"}
          </button>
          <span className="pill">항상 작동</span>
        </div>
      </div>

      <div className="auto-sell-summary-grid">
        <div className="status-block">
          <span>자동매도 작동</span>
          <strong>항상 작동 중</strong>
        </div>
        <div className="status-block">
          <span>자동매도 기준</span>
          <strong>매수 후 {trading.settings.targetProfitPercent.toFixed(2)}% 이익 도달 시 자동매도</strong>
        </div>
        <div className="status-block">
          <span>현재 추적 중</span>
          <strong>{activeTargets.length}건</strong>
        </div>
        <div className="status-block">
          <span>자동매도 확인 주기</span>
          <strong>{pollIntervalSeconds}초마다 확인</strong>
        </div>
        <div className="status-block">
          <span>최근 자동매도 확인</span>
          <strong>{formatShortDateTime(trading.lastCheckedAt)}</strong>
        </div>
        <div className="status-block">
          <span>재시도 큐</span>
          <strong>
            대기 {queuedOrderCount}건{blockedOrderCount > 0 ? ` / 중단 ${blockedOrderCount}건` : ""}
          </strong>
        </div>
        <div className="status-block">
          <span>계좌 상세 확인</span>
          <strong>{trading.accountSummary.updatedAt ? formatShortDateTime(trading.accountSummary.updatedAt) : "버튼으로 확인"}</strong>
        </div>
      </div>

      <div className="target-section target-section-first">
        <div className="target-section-header">
          <strong>자동매도 대상 목록</strong>
          <span>자동매도는 5초마다 가격을 확인하고, 주문 가능 현금과 주문내역은 위 버튼을 눌렀을 때만 다시 확인합니다. 미체결 매수 주문은 매수가 수정 또는 매수 취소를 시도할 수 있습니다.</span>
        </div>

        {trading.autoSellTargets.length === 0 ? (
          <p className="empty-state compact-empty-state">아직 원클릭 매수로 등록된 종목이 없습니다.</p>
        ) : (
          <ul className="target-list">
            {trading.autoSellTargets.map((target) => {
              const editingThisTarget = editingTargetId === target.id;
              const buyOrderEditable = isBuyOrderEditable(target);
              const savingThisTarget = savingBuyOrderActionId === target.id;

              return (
                <li key={target.id} className="target-card">
                  <div className="target-head">
                    <strong>
                      {target.symbol} / {target.exchange}
                    </strong>
                    <div className="target-actions">
                      <span
                        className={
                          target.status === "armed"
                            ? "target-status armed"
                            : target.status === "cancelled"
                              ? "target-status cancelled"
                              : "target-status completed"
                        }
                      >
                        {target.status === "armed" ? "추적 중" : target.status === "cancelled" ? "취소됨" : "완료"}
                      </span>
                      {buyOrderEditable ? (
                        <>
                          <button
                            type="button"
                            className="ghost-button target-secondary-button"
                            disabled={savingThisTarget}
                            onClick={() => startEditing(target)}
                          >
                            매수가 수정
                          </button>
                          <button
                            type="button"
                            className="ghost-button target-secondary-button"
                            disabled={savingThisTarget}
                            onClick={() => {
                              const confirmed = window.confirm(
                                `${target.symbol} 매수 주문을 취소하시겠습니까? 이미 체결된 주문이면 취소가 거절될 수 있습니다.`
                              );

                              if (!confirmed) {
                                return;
                              }

                              setSavingBuyOrderActionId(target.id);
                              setInlineError(null);
                              setInlineErrorTargetId(null);
                              void (async () => {
                                try {
                                  await onCancelBuyOrder(target.id);
                                  if (editingThisTarget) {
                                    stopEditing();
                                  }
                                } catch (error) {
                                  setInlineErrorTargetId(target.id);
                                  setInlineError(
                                    error instanceof Error ? error.message : "매수 주문 취소 실패"
                                  );
                                } finally {
                                  setSavingBuyOrderActionId((current) =>
                                    current === target.id ? null : current
                                  );
                                }
                              })();
                            }}
                          >
                            {savingThisTarget ? "처리 중" : "매수 취소"}
                          </button>
                        </>
                      ) : null}
                      {target.status === "armed" ? (
                        <button
                          className="ghost-button target-cancel-button"
                          disabled={cancellingTargetId === target.id || savingThisTarget}
                        onClick={() => {
                          setCancellingTargetId(target.id);
                          setInlineError(null);
                          setInlineErrorTargetId(null);
                          void (async () => {
                            try {
                              await onCancelTarget(target.id);
                              if (editingThisTarget) {
                                stopEditing();
                              }
                            } catch (error) {
                              setInlineErrorTargetId(target.id);
                              setInlineError(
                                error instanceof Error ? error.message : "자동매도 추적 취소 실패"
                              );
                            } finally {
                                setCancellingTargetId((current) => (current === target.id ? null : current));
                              }
                            })();
                          }}
                        >
                          {cancellingTargetId === target.id ? "취소 중" : "추적 취소"}
                        </button>
                      ) : null}
                    </div>
                  </div>
                  <div className="target-meta">
                    <span>등록수량 {target.requestedQuantity.toFixed(0)}주</span>
                    <span>남은수량 {target.remainingQuantity.toFixed(0)}주</span>
                    <span>매수가 {usdCurrency.format(target.entryPrice)}</span>
                    <span>목표가 {usdCurrency.format(target.targetPrice)}</span>
                    <span>매수주문 상태 {getBuyOrderStatusLabel(target.buyOrderStatus)}</span>
                    <span>체결수량 {target.buyFilledQuantity.toFixed(0)}주</span>
                    <span>미체결수량 {target.buyOpenQuantity.toFixed(0)}주</span>
                    {target.buyOrderNumber ? <span>매수주문번호 {target.buyOrderNumber}</span> : null}
                    {target.buyOrderUpdatedAt ? (
                      <span>주문상태 확인 {new Date(target.buyOrderUpdatedAt).toLocaleString()}</span>
                    ) : null}
                  </div>

                  {editingThisTarget ? (
                    <div className="target-edit-box">
                      <label>
                        <span>새 매수가(달러)</span>
                        <input
                          type="number"
                          min={0.01}
                          step={0.01}
                          value={editingLimitPrice}
                          onChange={(event) => setEditingLimitPrice(event.target.value)}
                        />
                      </label>
                      <div className="target-edit-actions">
                        <button
                          type="button"
                          className="ghost-button target-secondary-button"
                          disabled={savingThisTarget}
                          onClick={stopEditing}
                        >
                          닫기
                        </button>
                        <button
                          type="button"
                          className="primary-button target-primary-button"
                          disabled={savingThisTarget}
                          onClick={() => {
                            const nextPrice = Number(editingLimitPrice);

                            if (!Number.isFinite(nextPrice) || nextPrice <= 0) {
                              setInlineError("새 매수가는 0보다 크게 입력하세요.");
                              return;
                            }

                            setSavingBuyOrderActionId(target.id);
                            setInlineError(null);
                            setInlineErrorTargetId(null);
                            void (async () => {
                              try {
                                await onModifyBuyOrder(target.id, nextPrice);
                                stopEditing();
                              } catch (error) {
                                setInlineErrorTargetId(target.id);
                                setInlineError(
                                  error instanceof Error ? error.message : "매수 주문 수정 실패"
                                );
                              } finally {
                                setSavingBuyOrderActionId((current) =>
                                  current === target.id ? null : current
                                );
                              }
                            })();
                          }}
                        >
                          {savingThisTarget ? "수정 중" : "수정 적용"}
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {inlineError && inlineErrorTargetId === target.id ? (
                    <p className="error-text target-inline-error">{inlineError}</p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className={`auto-sell-monitor-status ${trading.lastError ? "error" : "normal"}`}>
        <p>{monitorStatusMessage}</p>
      </div>
    </section>
  );
}
