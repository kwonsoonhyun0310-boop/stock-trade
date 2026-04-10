import type { AutoSellEvent, AutoSellTarget } from "@trade/shared";
import type { KisOpenOrderRow, KisOrderHistoryRow } from "../../integrations/kis/types.js";

interface OrderQuantities {
  orderedQuantity: number;
  filledQuantity: number;
  openQuantity: number;
  orderPrice: number;
}

export interface BuyOrderSyncSnapshot extends OrderQuantities {
  status: AutoSellTarget["buyOrderStatus"];
}

export interface SellOrderCompletionSnapshot {
  orderNumber: string;
  symbol: string;
  exchange: AutoSellEvent["exchange"];
  quantity: number;
  orderPrice: number;
}

const toNumber = (value: string | number | undefined) => {
  const numericValue = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(numericValue) ? numericValue : 0;
};

const normalizeText = (value: string | undefined) => value?.trim() ?? "";

const normalizeOrderNumber = (value: string | undefined) => normalizeText(value);

const getRowSortKey = (row: { ord_dt?: string; ord_tmd?: string }) =>
  `${normalizeText(row.ord_dt)}${normalizeText(row.ord_tmd).replaceAll(":", "").padStart(9, "0")}`;

const orderRowsDescending = <T extends { ord_dt?: string; ord_tmd?: string }>(rows: T[]) =>
  [...rows].sort((left, right) => getRowSortKey(right).localeCompare(getRowSortKey(left)));

const matchesOrderNumber = (
  row: { odno?: string; orgn_odno?: string },
  orderNumber: string | undefined
) => {
  const normalizedOrderNumber = normalizeOrderNumber(orderNumber);
  if (!normalizedOrderNumber) {
    return false;
  }

  return (
    normalizeOrderNumber(row.odno) === normalizedOrderNumber ||
    normalizeOrderNumber(row.orgn_odno) === normalizedOrderNumber
  );
};

const isBuyRow = (row: { sll_buy_dvsn_cd?: string; sll_buy_dvsn_cd_name?: string }) => {
  if (normalizeText(row.sll_buy_dvsn_cd) === "02") {
    return true;
  }

  return normalizeText(row.sll_buy_dvsn_cd_name).includes("매수");
};

const isSellRow = (row: { sll_buy_dvsn_cd?: string; sll_buy_dvsn_cd_name?: string }) => {
  if (normalizeText(row.sll_buy_dvsn_cd) === "01") {
    return true;
  }

  return normalizeText(row.sll_buy_dvsn_cd_name).includes("매도");
};

const isRejectedRow = (row: { prcs_stat_name?: string; rjct_rson?: string; rjct_rson_name?: string }) =>
  normalizeText(row.prcs_stat_name).includes("거부") ||
  normalizeText(row.rjct_rson_name).length > 0 ||
  normalizeText(row.rjct_rson).length > 0;

const isCancelledRow = (row: {
  prcs_stat_name?: string;
  rvse_cncl_dvsn?: string;
  rvse_cncl_dvsn_name?: string;
}) => {
  const processStatus = normalizeText(row.prcs_stat_name);
  const reviseCancelStatus = normalizeText(row.rvse_cncl_dvsn);
  const reviseCancelName = normalizeText(row.rvse_cncl_dvsn_name);

  return (
    processStatus.includes("취소") ||
    reviseCancelName.includes("취소") ||
    reviseCancelStatus === "02" ||
    reviseCancelStatus.includes("취소")
  );
};

const readOrderQuantities = (row: {
  ft_ord_qty?: string;
  ft_ccld_qty?: string;
  nccs_qty?: string;
  ft_ord_unpr3?: string;
}): OrderQuantities => {
  const orderedQuantity = toNumber(row.ft_ord_qty);
  const filledQuantity = toNumber(row.ft_ccld_qty);
  const openQuantity = toNumber(row.nccs_qty);

  return {
    orderedQuantity: Math.max(orderedQuantity, filledQuantity + openQuantity),
    filledQuantity,
    openQuantity,
    orderPrice: toNumber(row.ft_ord_unpr3)
  };
};

export const resolveBuyOrderSyncSnapshot = (
  target: AutoSellTarget,
  openOrders: KisOpenOrderRow[],
  orderHistory: KisOrderHistoryRow[]
): BuyOrderSyncSnapshot | null => {
  if (!target.buyOrderNumber) {
    return null;
  }

  const matchingOpenRows = orderRowsDescending(
    openOrders.filter((row) => isBuyRow(row) && matchesOrderNumber(row, target.buyOrderNumber))
  );

  if (matchingOpenRows.length > 0) {
    const latestOpenRow = matchingOpenRows[0];
    const quantities = readOrderQuantities(latestOpenRow);

    return {
      status: quantities.filledQuantity > 0 ? "partially_filled" : "submitted",
      ...quantities
    };
  }

  const matchingHistoryRows = orderRowsDescending(
    orderHistory.filter((row) => isBuyRow(row) && matchesOrderNumber(row, target.buyOrderNumber))
  );

  if (matchingHistoryRows.length === 0) {
    return null;
  }

  const latestHistoryRow = matchingHistoryRows[0];
  const latestQuantities = readOrderQuantities(latestHistoryRow);
  const quantities = matchingHistoryRows.reduce<OrderQuantities>(
    (current, row) => {
      const next = readOrderQuantities(row);
      return {
        orderedQuantity: Math.max(current.orderedQuantity, next.orderedQuantity),
        filledQuantity: Math.max(current.filledQuantity, next.filledQuantity),
        openQuantity: current.openQuantity,
        orderPrice: current.orderPrice > 0 ? current.orderPrice : next.orderPrice
      };
    },
    {
      orderedQuantity: latestQuantities.orderedQuantity,
      filledQuantity: latestQuantities.filledQuantity,
      openQuantity: latestQuantities.openQuantity,
      orderPrice: latestQuantities.orderPrice
    }
  );
  const isRejected = isRejectedRow(latestHistoryRow);
  const isCancelled = isCancelledRow(latestHistoryRow);

  let status: AutoSellTarget["buyOrderStatus"] = "unknown";

  if (isRejected && quantities.filledQuantity <= 0) {
    status = "rejected";
  } else if (
    quantities.orderedQuantity > 0 &&
    quantities.openQuantity <= 0 &&
    quantities.filledQuantity >= quantities.orderedQuantity
  ) {
    status = "filled";
  } else if (quantities.filledQuantity > 0 && quantities.openQuantity > 0) {
    status = "partially_filled";
  } else if (isCancelled || (quantities.openQuantity <= 0 && quantities.filledQuantity < quantities.orderedQuantity)) {
    status = "cancelled";
  } else if (quantities.filledQuantity > 0) {
    status = "filled";
  }

  return {
    status,
    ...quantities
  };
};

export const resolveSellOrderCompletionSnapshot = (
  event: AutoSellEvent,
  orderHistory: KisOrderHistoryRow[]
): SellOrderCompletionSnapshot | null => {
  if (!event.orderNumber) {
    return null;
  }

  const matchingRows = orderRowsDescending(
    orderHistory.filter((row) => isSellRow(row) && matchesOrderNumber(row, event.orderNumber))
  );

  if (matchingRows.length === 0) {
    return null;
  }

  const latestRow = matchingRows[0];
  const quantities = readOrderQuantities(latestRow);

  if (isRejectedRow(latestRow) || isCancelledRow(latestRow)) {
    return null;
  }

  if (quantities.filledQuantity < event.quantity || quantities.openQuantity > 0) {
    return null;
  }

  return {
    orderNumber: event.orderNumber,
    symbol: event.symbol,
    exchange: event.exchange,
    quantity: quantities.filledQuantity,
    orderPrice: quantities.orderPrice > 0 ? quantities.orderPrice : event.orderPrice
  };
};
