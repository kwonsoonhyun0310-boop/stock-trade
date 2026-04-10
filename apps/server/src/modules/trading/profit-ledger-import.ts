import type { ExchangeCode, ProfitLedgerEntry } from "@trade/shared";
import type { KisOrderHistoryRow } from "../../integrations/kis/types.js";
import { dedupeProfitLedgerEntries } from "./profit-ledger.js";

interface HistoricalFill {
  orderNumber: string;
  symbol: string;
  exchange: ExchangeCode;
  side: "buy" | "sell";
  quantity: number;
  fillPrice: number;
  completedAt: string;
  sortKey: string;
}

interface PositionLot {
  quantity: number;
  price: number;
}

const toNumber = (value: string | number | undefined) => {
  const numericValue = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(numericValue) ? numericValue : 0;
};

const normalizeText = (value: string | undefined) => value?.trim() ?? "";

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

const normalizeExchange = (row: Pick<KisOrderHistoryRow, "ovrs_excg_cd" | "tr_mket_name">): ExchangeCode => {
  const exchange = normalizeText(row.ovrs_excg_cd).toUpperCase();

  if (exchange === "NASD" || exchange === "NYSE" || exchange === "AMEX") {
    return exchange;
  }

  const marketName = normalizeText(row.tr_mket_name).toUpperCase();

  if (marketName.includes("NYSE") || marketName.includes("뉴욕")) {
    return "NYSE";
  }

  if (marketName.includes("AMEX") || marketName.includes("ARCA")) {
    return "AMEX";
  }

  return "NASD";
};

const toOrderIsoDate = (orderDate: string, orderTime: string) => {
  const dateText = normalizeText(orderDate);
  const timeText = normalizeText(orderTime).replaceAll(":", "").padStart(6, "0").slice(0, 6);

  if (dateText.length !== 8) {
    return new Date(0).toISOString();
  }

  const year = dateText.slice(0, 4);
  const month = dateText.slice(4, 6);
  const day = dateText.slice(6, 8);
  const hour = timeText.slice(0, 2) || "00";
  const minute = timeText.slice(2, 4) || "00";
  const second = timeText.slice(4, 6) || "00";

  return new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}+09:00`).toISOString();
};

const getSortKey = (row: Pick<KisOrderHistoryRow, "ord_dt" | "ord_tmd">) =>
  `${normalizeText(row.ord_dt)}${normalizeText(row.ord_tmd).replaceAll(":", "").padStart(6, "0")}`;

const toHistoricalFill = (row: KisOrderHistoryRow): HistoricalFill | null => {
  if (isRejectedRow(row) || isCancelledRow(row)) {
    return null;
  }

  const quantity = toNumber(row.ft_ccld_qty);
  const fillPrice = toNumber(row.ft_ccld_unpr3) || toNumber(row.ft_ord_unpr3);
  const orderNumber = normalizeText(row.odno);

  if (!orderNumber || quantity <= 0 || fillPrice <= 0) {
    return null;
  }

  const side = isBuyRow(row) ? "buy" : isSellRow(row) ? "sell" : null;

  if (!side) {
    return null;
  }

  return {
    orderNumber,
    symbol: normalizeText(row.pdno).toUpperCase(),
    exchange: normalizeExchange(row),
    side,
    quantity,
    fillPrice,
    completedAt: toOrderIsoDate(normalizeText(row.ord_dt), normalizeText(row.ord_tmd)),
    sortKey: getSortKey(row)
  };
};

const aggregateHistoricalFills = (rows: KisOrderHistoryRow[]) => {
  const latestRowByOrder = new Map<string, HistoricalFill>();

  for (const row of [...rows].sort((left, right) => getSortKey(left).localeCompare(getSortKey(right)))) {
    const fill = toHistoricalFill(row);

    if (!fill) {
      continue;
    }

    latestRowByOrder.set(fill.orderNumber, fill);
  }

  return [...latestRowByOrder.values()].sort((left, right) => left.sortKey.localeCompare(right.sortKey));
};

export const buildHistoricalProfitLedgerEntries = (rows: KisOrderHistoryRow[]) => {
  const fills = aggregateHistoricalFills(rows);
  const lotsBySymbol = new Map<string, PositionLot[]>();
  const entries: ProfitLedgerEntry[] = [];

  for (const fill of fills) {
    const positionKey = `${fill.exchange}:${fill.symbol}`;
    const lots = lotsBySymbol.get(positionKey) ?? [];

    if (fill.side === "buy") {
      lots.push({
        quantity: fill.quantity,
        price: fill.fillPrice
      });
      lotsBySymbol.set(positionKey, lots);
      continue;
    }

    let remainingQuantity = fill.quantity;
    let totalCostBasis = 0;

    while (remainingQuantity > 0 && lots.length > 0) {
      const lot = lots[0];
      const matchedQuantity = Math.min(remainingQuantity, lot.quantity);
      totalCostBasis += matchedQuantity * lot.price;
      lot.quantity -= matchedQuantity;
      remainingQuantity -= matchedQuantity;

      if (lot.quantity <= 0) {
        lots.shift();
      }
    }

    if (remainingQuantity > 0) {
      // If older buy lots are outside the imported history window, keep the unmatched portion neutral.
      totalCostBasis += remainingQuantity * fill.fillPrice;
    }

    const averageEntryPrice = fill.quantity > 0 ? totalCostBasis / fill.quantity : fill.fillPrice;
    const realizedProfitUsd = (fill.fillPrice - averageEntryPrice) * fill.quantity;
    const realizedProfitPercent =
      averageEntryPrice > 0 ? ((fill.fillPrice - averageEntryPrice) / averageEntryPrice) * 100 : 0;

    entries.push({
      id: `history-${fill.orderNumber}`,
      sourceEventId: `history-${fill.orderNumber}`,
      symbol: fill.symbol,
      exchange: fill.exchange,
      quantity: fill.quantity,
      entryPrice: Number(averageEntryPrice.toFixed(2)),
      exitPrice: Number(fill.fillPrice.toFixed(2)),
      realizedProfitUsd: Number(realizedProfitUsd.toFixed(2)),
      realizedProfitPercent: Number(realizedProfitPercent.toFixed(2)),
      targetProfitPercent: 0,
      completedAt: fill.completedAt,
      orderNumber: fill.orderNumber
    });

    lotsBySymbol.set(positionKey, lots);
  }

  return dedupeProfitLedgerEntries(entries);
};
