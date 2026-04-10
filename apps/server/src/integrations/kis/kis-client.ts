import { resolve } from "node:path";
import type { ExchangeCode, HoldingSnapshot } from "@trade/shared";
import { APP_ROOT, env } from "../../config/env.js";
import { JsonStore } from "../../lib/json-store.js";
import type {
  KisApiEnvelope,
  KisBalanceRow,
  KisOpenOrderRow,
  KisOrderOutput,
  KisOrderHistoryRow,
  KisPsamountOutput,
  KisTokenResponse
} from "./types.js";

const USER_AGENT = "Codex-KIS-Trade-Dashboard/1.0";
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const getBalanceExchangeCodes = (codes: ExchangeCode[], kisEnv: "real" | "demo") => {
  if (kisEnv === "real" && codes.includes("NASD")) {
    return ["NASD"] as ExchangeCode[];
  }

  return [...new Set(codes)];
};

const toNumber = (value: string | number | undefined) => {
  const numericValue = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(numericValue) ? numericValue : 0;
};

const ACCOUNT_SUMMARY_SYMBOLS: Record<ExchangeCode, string> = {
  NASD: "AAPL",
  NYSE: "KO",
  AMEX: "SPY"
};

const usDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/New_York",
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
});

const toUsOrderDate = (value: Date) => usDateFormatter.format(value).replaceAll("-", "");

const toOrderTrId = (
  exchange: ExchangeCode,
  side: "buy" | "sell",
  kisEnv: "real" | "demo"
) => {
  if (exchange === "NASD" || exchange === "NYSE" || exchange === "AMEX") {
    if (side === "buy") {
      return kisEnv === "real" ? "TTTT1002U" : "VTTT1002U";
    }

    return kisEnv === "real" ? "TTTT1006U" : "VTTT1006U";
  }

  throw new Error(`Unsupported exchange for order: ${exchange}`);
};

const toOrderReviseCancelTrId = (exchange: ExchangeCode, kisEnv: "real" | "demo") => {
  if (exchange === "NASD" || exchange === "NYSE" || exchange === "AMEX") {
    return kisEnv === "real" ? "TTTT1004U" : "VTTT1004U";
  }

  throw new Error(`Unsupported exchange for revise/cancel: ${exchange}`);
};

interface RequestOptions {
  method?: "GET" | "POST";
  path: string;
  trId?: string;
  params?: Record<string, string>;
  body?: Record<string, string>;
  withHash?: boolean;
}

interface TokenCache {
  token: string;
  expiresAt: number;
}

interface PersistedTokenCache extends TokenCache {
  appKey: string;
  baseUrl: string;
}

export class KisClient {
  private tokenCache?: TokenCache;
  private tokenRequest?: Promise<string>;
  private tokenLoaded = false;
  private readonly tokenStore = new JsonStore<PersistedTokenCache>(
    resolve(
      APP_ROOT,
      `apps/server/data/kis-token-${env.KIS_ENV}-${env.KIS_APP_KEY.slice(-6) || "default"}.json`
    ),
    {
      token: "",
      expiresAt: 0,
      appKey: "",
      baseUrl: ""
    }
  );

  isConfigured() {
    return env.kisConfigured;
  }

  async getUsHoldings(): Promise<HoldingSnapshot[]> {
    if (!this.isConfigured()) {
      return [];
    }

    const pages: HoldingSnapshot[][] = [];
    const balanceExchangeCodes = getBalanceExchangeCodes(env.kisExchangeCodes, env.KIS_ENV);

    for (const exchange of balanceExchangeCodes) {
      // KIS has per-second request limits, so avoid parallel or duplicate exchange balance scans.
      const holdings = await this.fetchExchangeHoldings(exchange);
      pages.push(holdings);
      await sleep(1100);
    }

    return pages.flat().sort((left, right) => right.profitPercent - left.profitPercent);
  }

  async getOrderableCashUsd(): Promise<number> {
    if (!this.isConfigured()) {
      return 0;
    }

    const balanceExchangeCodes = getBalanceExchangeCodes(env.kisExchangeCodes, env.KIS_ENV);
    const exchange = balanceExchangeCodes[0] ?? "NASD";
    const itemCode = ACCOUNT_SUMMARY_SYMBOLS[exchange] ?? "AAPL";
    const response = await this.request<KisPsamountOutput>({
      path: "/uapi/overseas-stock/v1/trading/inquire-psamount",
      trId: env.KIS_ENV === "real" ? "TTTS3007R" : "VTTS3007R",
      params: {
        CANO: env.KIS_ACCOUNT_NO,
        ACNT_PRDT_CD: env.KIS_ACCOUNT_PRODUCT_CODE,
        OVRS_EXCG_CD: exchange,
        OVRS_ORD_UNPR: "1",
        ITEM_CD: itemCode
      }
    });

    const output = response.output ?? {};
    return (
      toNumber(output.ovrs_ord_psbl_amt) ||
      toNumber(output.frcr_ord_psbl_amt1) ||
      toNumber(output.ord_psbl_frcr_amt)
    );
  }

  async getUsOpenOrders(): Promise<KisOpenOrderRow[]> {
    if (!this.isConfigured()) {
      return [];
    }

    const rows: KisOpenOrderRow[] = [];
    const exchangeCodes = getBalanceExchangeCodes(env.kisExchangeCodes, env.KIS_ENV);

    for (const exchange of exchangeCodes) {
      let continuation = "";
      let fk200 = "";
      let nk200 = "";

      do {
        const response = await this.request<KisOpenOrderRow[]>({
          path: "/uapi/overseas-stock/v1/trading/inquire-nccs",
          trId: env.KIS_ENV === "real" ? "TTTS3018R" : "VTTS3018R",
          params: {
            CANO: env.KIS_ACCOUNT_NO,
            ACNT_PRDT_CD: env.KIS_ACCOUNT_PRODUCT_CODE,
            OVRS_EXCG_CD: exchange,
            SORT_SQN: "DS",
            CTX_AREA_FK200: fk200,
            CTX_AREA_NK200: nk200
          }
        });

        const currentRows = Array.isArray(response.output) ? response.output : [];
        rows.push(...currentRows);

        continuation = response.tr_cont ?? "";
        fk200 = response.ctx_area_fk200 ?? "";
        nk200 = response.ctx_area_nk200 ?? "";
      } while (continuation === "M" || continuation === "F");

      await sleep(1100);
    }

    return rows;
  }

  async getUsOrderHistory(lookbackDays = 14): Promise<KisOrderHistoryRow[]> {
    if (!this.isConfigured()) {
      return [];
    }

    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - lookbackDays);
    return this.getUsOrderHistoryRange(startDate, today);
  }

  async getUsOrderHistoryWindows(lookbackDays = 365, windowDays = 90): Promise<KisOrderHistoryRow[]> {
    if (!this.isConfigured()) {
      return [];
    }

    const allRows: KisOrderHistoryRow[] = [];
    const seenKeys = new Set<string>();
    const endDate = new Date();
    const startBoundary = new Date(endDate);
    startBoundary.setDate(startBoundary.getDate() - lookbackDays);
    let cursorEnd = new Date(endDate);

    while (cursorEnd.getTime() >= startBoundary.getTime()) {
      const cursorStart = new Date(cursorEnd);
      cursorStart.setDate(cursorStart.getDate() - (windowDays - 1));

      if (cursorStart.getTime() < startBoundary.getTime()) {
        cursorStart.setTime(startBoundary.getTime());
      }

      const currentRows = await this.getUsOrderHistoryRange(cursorStart, cursorEnd);

      for (const row of currentRows) {
        const key = [
          row.ord_dt,
          row.odno,
          row.orgn_odno,
          row.sll_buy_dvsn_cd,
          row.ft_ccld_qty,
          row.ft_ccld_unpr3,
          row.prcs_stat_name
        ].join(":");

        if (seenKeys.has(key)) {
          continue;
        }

        seenKeys.add(key);
        allRows.push(row);
      }

      cursorEnd = new Date(cursorStart);
      cursorEnd.setDate(cursorEnd.getDate() - 1);

      if (cursorEnd.getTime() >= startBoundary.getTime()) {
        await sleep(1100);
      }
    }

    return allRows.sort((left, right) => {
      const leftKey = `${left.ord_dt ?? ""}${String(left.ord_tmd ?? "").replaceAll(":", "")}`;
      const rightKey = `${right.ord_dt ?? ""}${String(right.ord_tmd ?? "").replaceAll(":", "")}`;
      return rightKey.localeCompare(leftKey);
    });
  }

  private async getUsOrderHistoryRange(startDate: Date, endDate: Date): Promise<KisOrderHistoryRow[]> {
    const rows: KisOrderHistoryRow[] = [];
    let continuation = "";
    let fk200 = "";
    let nk200 = "";

    do {
      const response = await this.request<KisOrderHistoryRow[]>({
        path: "/uapi/overseas-stock/v1/trading/inquire-ccnl",
        trId: env.KIS_ENV === "real" ? "TTTS3035R" : "VTTS3035R",
        params: {
          CANO: env.KIS_ACCOUNT_NO,
          ACNT_PRDT_CD: env.KIS_ACCOUNT_PRODUCT_CODE,
          PDNO: env.KIS_ENV === "real" ? "%" : "",
          ORD_STRT_DT: toUsOrderDate(startDate),
          ORD_END_DT: toUsOrderDate(endDate),
          SLL_BUY_DVSN: "00",
          CCLD_NCCS_DVSN: "00",
          OVRS_EXCG_CD: env.KIS_ENV === "real" ? "NASD" : "",
          SORT_SQN: "DS",
          ORD_DT: "",
          ORD_GNO_BRNO: "",
          ODNO: "",
          CTX_AREA_NK200: nk200,
          CTX_AREA_FK200: fk200
        }
      });

      const currentRows = Array.isArray(response.output) ? response.output : [];
      rows.push(...currentRows);

      continuation = response.tr_cont ?? "";
      fk200 = response.ctx_area_fk200 ?? "";
      nk200 = response.ctx_area_nk200 ?? "";
    } while (continuation === "M" || continuation === "F");

    return rows;
  }

  async sellHolding(holding: HoldingSnapshot): Promise<KisOrderOutput> {
    return this.placeOrder({
      symbol: holding.symbol,
      exchange: holding.exchange,
      quantity: Math.floor(holding.orderableQuantity),
      limitPrice: holding.currentPrice,
      side: "sell"
    });
  }

  async placeOrder(input: {
    symbol: string;
    exchange: ExchangeCode;
    quantity: number;
    limitPrice: number;
    side: "buy" | "sell";
  }): Promise<KisOrderOutput> {
    if (!this.isConfigured()) {
      throw new Error("KIS credentials are missing.");
    }

    const orderPrice = input.limitPrice.toFixed(2);
    const result = await this.request<KisOrderOutput>({
      method: "POST",
      path: "/uapi/overseas-stock/v1/trading/order",
      trId: toOrderTrId(input.exchange, input.side, env.KIS_ENV),
      withHash: true,
      body: {
        CANO: env.KIS_ACCOUNT_NO,
        ACNT_PRDT_CD: env.KIS_ACCOUNT_PRODUCT_CODE,
        OVRS_EXCG_CD: input.exchange,
        PDNO: input.symbol,
        ORD_QTY: String(Math.floor(input.quantity)),
        OVRS_ORD_UNPR: orderPrice,
        CTAC_TLNO: "",
        MGCO_APTM_ODNO: "",
        SLL_TYPE: input.side === "sell" ? "00" : "",
        ORD_SVR_DVSN_CD: "0",
        ORD_DVSN: "00"
      }
    });

    if (!result.output) {
      throw new Error("Order response did not include output.");
    }

    return result.output;
  }

  async reviseOrCancelOrder(input: {
    symbol: string;
    exchange: ExchangeCode;
    originalOrderNumber: string;
    quantity: number;
    limitPrice?: number;
    action: "modify" | "cancel";
  }): Promise<KisOrderOutput> {
    if (!this.isConfigured()) {
      throw new Error("KIS credentials are missing.");
    }

    const result = await this.request<KisOrderOutput>({
      method: "POST",
      path: "/uapi/overseas-stock/v1/trading/order-rvsecncl",
      trId: toOrderReviseCancelTrId(input.exchange, env.KIS_ENV),
      withHash: true,
      body: {
        CANO: env.KIS_ACCOUNT_NO,
        ACNT_PRDT_CD: env.KIS_ACCOUNT_PRODUCT_CODE,
        OVRS_EXCG_CD: input.exchange,
        PDNO: input.symbol,
        ORGN_ODNO: input.originalOrderNumber,
        RVSE_CNCL_DVSN_CD: input.action === "modify" ? "01" : "02",
        ORD_QTY: String(Math.floor(input.quantity)),
        OVRS_ORD_UNPR:
          input.action === "modify" ? (input.limitPrice ?? 0).toFixed(2) : "0",
        MGCO_APTM_ODNO: "",
        ORD_SVR_DVSN_CD: "0"
      }
    });

    if (!result.output) {
      throw new Error("Revise/cancel response did not include output.");
    }

    return result.output;
  }

  private async fetchExchangeHoldings(exchange: ExchangeCode): Promise<HoldingSnapshot[]> {
    let continuation = "";
    let fk200 = "";
    let nk200 = "";
    const holdings: HoldingSnapshot[] = [];

    do {
      const response = await this.request<KisBalanceRow[]>({
        path: "/uapi/overseas-stock/v1/trading/inquire-balance",
        trId: env.KIS_ENV === "real" ? "TTTS3012R" : "VTTS3012R",
        params: {
          CANO: env.KIS_ACCOUNT_NO,
          ACNT_PRDT_CD: env.KIS_ACCOUNT_PRODUCT_CODE,
          OVRS_EXCG_CD: exchange,
          TR_CRCY_CD: "USD",
          CTX_AREA_FK200: fk200,
          CTX_AREA_NK200: nk200
        }
      });

      const rows = Array.isArray(response.output1) ? response.output1 : [];
      const mappedRows = rows
        .map((row) => this.toHoldingSnapshot(row))
        .filter((row): row is HoldingSnapshot => row !== null);

      holdings.push(...mappedRows);

      continuation = response.tr_cont ?? "";
      fk200 = response.ctx_area_fk200 ?? "";
      nk200 = response.ctx_area_nk200 ?? "";
    } while (continuation === "M" || continuation === "F");

    return holdings;
  }

  private toHoldingSnapshot(row: KisBalanceRow): HoldingSnapshot | null {
    const quantity = toNumber(row.ovrs_cblc_qty);
    const orderableQuantity = toNumber(row.ord_psbl_qty);
    const currentPrice = toNumber(row.now_pric2);
    const averagePrice = toNumber(row.pchs_avg_pric);

    if (quantity <= 0 || currentPrice <= 0 || averagePrice <= 0) {
      return null;
    }

    return {
      symbol: row.ovrs_pdno,
      exchange: row.ovrs_excg_cd as ExchangeCode,
      currency: row.tr_crcy_cd || "USD",
      quantity,
      orderableQuantity,
      averagePrice,
      currentPrice,
      profitPercent: toNumber(row.evlu_pfls_rt),
      profitAmount: toNumber(row.frcr_evlu_pfls_amt),
      evaluatedAmount: toNumber(row.ovrs_stck_evlu_amt),
      updatedAt: new Date().toISOString()
    };
  }

  private async request<T>({
    method = "GET",
    path,
    trId,
    params,
    body,
    withHash = false
  }: RequestOptions): Promise<KisApiEnvelope<T>> {
    const token = await this.getAccessToken();
    const headers: Record<string, string> = {
      "content-type": "application/json",
      accept: "application/json",
      charset: "UTF-8",
      "user-agent": USER_AGENT,
      authorization: `Bearer ${token}`,
      appkey: env.KIS_APP_KEY,
      appsecret: env.KIS_APP_SECRET
    };

    if (trId) {
      headers.tr_id = trId;
      headers.custtype = "P";
      headers.tr_cont = "";
    }

    if (withHash && body) {
      headers.hashkey = await this.getHashKey(body, token);
    }

    const url = new URL(path, env.KIS_BASE_URL);

    if (params) {
      Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
    }

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined
    });

    const json = (await response.json()) as KisApiEnvelope<T>;
    json.tr_cont = response.headers.get("tr_cont") ?? undefined;

    if (!response.ok || json.rt_cd !== "0") {
      throw new Error(`${json.msg_cd ?? response.status}: ${json.msg1 ?? "KIS request failed"}`);
    }

    return json;
  }

  private async getHashKey(payload: Record<string, string>, token: string): Promise<string> {
    const response = await fetch(new URL("/uapi/hashkey", env.KIS_BASE_URL), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
        appkey: env.KIS_APP_KEY,
        appsecret: env.KIS_APP_SECRET,
        "user-agent": USER_AGENT
      },
      body: JSON.stringify(payload)
    });

    const json = (await response.json()) as { HASH?: string };

    if (!response.ok || !json.HASH) {
      throw new Error("Failed to issue KIS hash key.");
    }

    return json.HASH;
  }

  private async getAccessToken(): Promise<string> {
    await this.loadTokenCache();

    if (this.tokenCache && this.tokenCache.expiresAt > Date.now() + 60_000) {
      return this.tokenCache.token;
    }

    if (this.tokenRequest) {
      return this.tokenRequest;
    }

    // Prevent concurrent exchange/account calls from issuing multiple tokens at once.
    this.tokenRequest = this.issueAccessToken().finally(() => {
      this.tokenRequest = undefined;
    });

    return this.tokenRequest;
  }

  private async loadTokenCache() {
    if (this.tokenLoaded) {
      return;
    }

    this.tokenLoaded = true;

    const cached = await this.tokenStore.read();

    if (
      cached.token &&
      cached.expiresAt > Date.now() + 60_000 &&
      cached.appKey === env.KIS_APP_KEY &&
      cached.baseUrl === env.KIS_BASE_URL
    ) {
      this.tokenCache = {
        token: cached.token,
        expiresAt: cached.expiresAt
      };
    }
  }

  private async issueAccessToken(): Promise<string> {
    const response = await fetch(new URL("/oauth2/tokenP", env.KIS_BASE_URL), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
        "user-agent": USER_AGENT
      },
      body: JSON.stringify({
        grant_type: "client_credentials",
        appkey: env.KIS_APP_KEY,
        appsecret: env.KIS_APP_SECRET
      })
    });

    const json = (await response.json()) as
      | KisTokenResponse
      | {
          error_code?: string;
          error_description?: string;
        };

    if (!response.ok || !("access_token" in json) || !json.access_token) {
      const errorCode = "error_code" in json ? json.error_code : undefined;
      const errorMessage = "error_description" in json ? json.error_description : undefined;
      throw new Error(
        [errorCode, errorMessage].filter(Boolean).join(": ") || "Failed to obtain KIS access token."
      );
    }

    const expiresAt = new Date(json.access_token_token_expired).getTime();
    this.tokenCache = {
      token: json.access_token,
      expiresAt: Number.isFinite(expiresAt) ? expiresAt : Date.now() + 6 * 60 * 60 * 1000
    };

    await this.tokenStore.write({
      token: this.tokenCache.token,
      expiresAt: this.tokenCache.expiresAt,
      appKey: env.KIS_APP_KEY,
      baseUrl: env.KIS_BASE_URL
    });

    return this.tokenCache.token;
  }
}
