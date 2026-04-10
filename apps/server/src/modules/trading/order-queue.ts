import { randomUUID } from "node:crypto";
import type { AutoSellTarget, TradingOrderQueueItem } from "@trade/shared";

export interface PersistedOrderQueueItem extends TradingOrderQueueItem {}

const RETRYABLE_ERROR_PATTERNS = [
  /timeout/i,
  /timed out/i,
  /temporar/i,
  /잠시/i,
  /일시/i,
  /network/i,
  /fetch/i,
  /socket/i,
  /ECONN/i,
  /EPIPE/i,
  /reset/i,
  /초당/i,
  /횟수/i,
  /초과/i,
  /rate/i,
  /\b429\b/,
  /\b500\b/,
  /\b502\b/,
  /\b503\b/,
  /\b504\b/
];

const NON_RETRYABLE_ERROR_PATTERNS = [
  /거래신청/i,
  /주문 가능 현금/i,
  /현금 부족/i,
  /수량 부족/i,
  /잔고 부족/i,
  /거부/i,
  /지원되지/i,
  /존재하지 않습니다/i,
  /취소 가능한/i,
  /수정 가능한/i,
  /유효하지/i,
  /invalid/i,
  /모의/i,
  /실전/i
];

const ORDER_RETRY_DELAYS_MS = [15_000, 30_000, 60_000, 180_000];
export const MAX_ORDER_RETRY_ATTEMPTS = ORDER_RETRY_DELAYS_MS.length + 1;

const toIsoAfter = (ms: number) => new Date(Date.now() + ms).toISOString();

export const normalizeOrderQueueItem = (item: TradingOrderQueueItem): TradingOrderQueueItem => {
  const normalizedStatus = item.status === "running" ? "retry_wait" : item.status;
  const createdAt = item.createdAt || new Date().toISOString();
  const updatedAt = item.updatedAt || createdAt;

  return {
    ...item,
    kind:
      item.kind === "one_click_buy" ||
      item.kind === "buy_modify" ||
      item.kind === "buy_cancel" ||
      item.kind === "auto_sell"
        ? item.kind
        : "auto_sell",
    status: normalizedStatus,
    attemptCount: Number.isFinite(item.attemptCount) ? item.attemptCount : 0,
    createdAt,
    updatedAt,
    nextAttemptAt: item.nextAttemptAt || updatedAt
  };
};

export const createAutoSellQueueItem = (input: {
  target: AutoSellTarget;
  quantity: number;
  limitPrice: number;
  triggerProfitPercent: number;
  createdAt: string;
}): TradingOrderQueueItem => ({
  id: randomUUID(),
  kind: "auto_sell",
  targetId: input.target.id,
  symbol: input.target.symbol,
  exchange: input.target.exchange,
  quantity: input.quantity,
  limitPrice: input.limitPrice,
  triggerProfitPercent: input.triggerProfitPercent,
  targetProfitPercent: input.target.targetProfitPercent,
  status: "queued",
  attemptCount: 0,
  createdAt: input.createdAt,
  updatedAt: input.createdAt,
  nextAttemptAt: input.createdAt
});

export const createManualQueueItem = (input: {
  kind: "one_click_buy" | "buy_modify" | "buy_cancel";
  target: AutoSellTarget;
  quantity: number;
  limitPrice: number;
  createdAt: string;
}): TradingOrderQueueItem => ({
  id: randomUUID(),
  kind: input.kind,
  targetId: input.target.id,
  symbol: input.target.symbol,
  exchange: input.target.exchange,
  quantity: input.quantity,
  limitPrice: input.limitPrice,
  triggerProfitPercent: 0,
  targetProfitPercent: input.target.targetProfitPercent,
  status: "queued",
  attemptCount: 0,
  createdAt: input.createdAt,
  updatedAt: input.createdAt,
  nextAttemptAt: input.createdAt
});

export const getQueueKey = (item: Pick<TradingOrderQueueItem, "kind" | "targetId">) =>
  `${item.kind}:${item.targetId}`;

export const upsertAutoSellQueueItem = (
  queue: TradingOrderQueueItem[],
  input: {
    target: AutoSellTarget;
    quantity: number;
    limitPrice: number;
    triggerProfitPercent: number;
    queuedAt: string;
  }
) => {
  const existing = queue.find((item) => item.targetId === input.target.id && item.kind === "auto_sell");

  if (!existing) {
    const created = createAutoSellQueueItem({
      target: input.target,
      quantity: input.quantity,
      limitPrice: input.limitPrice,
      triggerProfitPercent: input.triggerProfitPercent,
      createdAt: input.queuedAt
    });

    return {
      queue: [created, ...queue],
      item: created,
      created: true
    };
  }

  if (existing.status === "running") {
    return {
      queue,
      item: existing,
      created: false
    };
  }

  const updated: TradingOrderQueueItem = {
    ...existing,
    symbol: input.target.symbol,
    exchange: input.target.exchange,
    quantity: input.quantity,
    limitPrice: input.limitPrice,
    triggerProfitPercent: input.triggerProfitPercent,
    targetProfitPercent: input.target.targetProfitPercent,
    updatedAt: input.queuedAt,
    status: existing.status === "blocked" ? "blocked" : existing.status
  };

  return {
    queue: queue.map((item) => (item.id === existing.id ? updated : item)),
    item: updated,
    created: false
  };
};

export const upsertManualQueueItem = (
  queue: TradingOrderQueueItem[],
  input: {
    kind: "one_click_buy" | "buy_modify" | "buy_cancel";
    target: AutoSellTarget;
    quantity: number;
    limitPrice: number;
    queuedAt: string;
  }
) => {
  const existing = queue.find((item) => item.targetId === input.target.id && item.kind === input.kind);

  if (!existing) {
    const created = createManualQueueItem({
      kind: input.kind,
      target: input.target,
      quantity: input.quantity,
      limitPrice: input.limitPrice,
      createdAt: input.queuedAt
    });

    return {
      queue: [created, ...queue],
      item: created,
      created: true
    };
  }

  if (existing.status === "running") {
    return {
      queue,
      item: existing,
      created: false
    };
  }

  const updated: TradingOrderQueueItem = {
    ...existing,
    quantity: input.quantity,
    limitPrice: input.limitPrice,
    updatedAt: input.queuedAt,
    status: existing.status === "blocked" ? "blocked" : existing.status
  };

  return {
    queue: queue.map((item) => (item.id === existing.id ? updated : item)),
    item: updated,
    created: false
  };
};

export const getDueQueueItem = (queue: TradingOrderQueueItem[]) => {
  const now = Date.now();

  return [...queue]
    .filter((item) => item.status !== "blocked" && new Date(item.nextAttemptAt).getTime() <= now)
    .sort((left, right) => {
      const leftTime = new Date(left.nextAttemptAt).getTime();
      const rightTime = new Date(right.nextAttemptAt).getTime();

      if (leftTime !== rightTime) {
        return leftTime - rightTime;
      }

      return left.createdAt.localeCompare(right.createdAt);
    })[0];
};

export const markQueueItemRunning = (
  item: TradingOrderQueueItem,
  startedAt: string
): TradingOrderQueueItem => ({
  ...item,
  status: "running",
  attemptCount: item.attemptCount + 1,
  lastAttemptAt: startedAt,
  updatedAt: startedAt,
  lastError: undefined
});

export const deferQueueItemUntilNextCheck = (
  item: TradingOrderQueueItem,
  nextAttemptAt: string,
  updatedAt: string
): TradingOrderQueueItem => ({
  ...item,
  status: "queued",
  nextAttemptAt,
  updatedAt
});

export const getRetryDelayMs = (attemptCount: number) =>
  ORDER_RETRY_DELAYS_MS[Math.max(0, Math.min(ORDER_RETRY_DELAYS_MS.length - 1, attemptCount - 1))];

export const shouldRetryOrderError = (error: unknown, attemptCount: number) => {
  if (attemptCount >= MAX_ORDER_RETRY_ATTEMPTS) {
    return false;
  }

  const message = error instanceof Error ? error.message : String(error ?? "");

  if (NON_RETRYABLE_ERROR_PATTERNS.some((pattern) => pattern.test(message))) {
    return false;
  }

  if (RETRYABLE_ERROR_PATTERNS.some((pattern) => pattern.test(message))) {
    return true;
  }

  return attemptCount < 2;
};

export const markQueueItemRetryWaiting = (
  item: TradingOrderQueueItem,
  errorMessage: string,
  updatedAt: string
): TradingOrderQueueItem => ({
  ...item,
  status: "retry_wait",
  updatedAt,
  nextAttemptAt: toIsoAfter(getRetryDelayMs(item.attemptCount)),
  lastError: errorMessage
});

export const markQueueItemBlocked = (
  item: TradingOrderQueueItem,
  errorMessage: string,
  updatedAt: string
): TradingOrderQueueItem => ({
  ...item,
  status: "blocked",
  updatedAt,
  nextAttemptAt: updatedAt,
  lastError: errorMessage
});
