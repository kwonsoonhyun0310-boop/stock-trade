import { useEffect, useState } from "react";
import type {
  ExchangeCode,
  OneClickBuyPrecheckResponse,
  OneClickBuyRequest,
  OneClickBuyResponse,
  SymbolSearchResult
} from "@trade/shared";
import { BuyConfirmDialog } from "./buy-confirm-dialog.js";
import type { FavoriteSymbol } from "../lib/favorite-symbols.js";
import { useSymbolSearch } from "../hooks/use-symbol-search.js";

interface OneClickBuyPanelProps {
  targetProfitPercent: number;
  usdKrwRate: number;
  usdKrwUpdatedAt?: string;
  presetSelection?: {
    symbol: string;
    requestId: number;
  } | null;
  onAddFavorite: (favorite: Omit<FavoriteSymbol, "savedAt">) => void;
  isFavorite: (symbol: string, exchange: ExchangeCode) => boolean;
  onPrecheck: (order: OneClickBuyRequest) => Promise<OneClickBuyPrecheckResponse>;
  onSubmit: (order: OneClickBuyRequest) => Promise<OneClickBuyResponse>;
}

interface BuyConfirmationDraft {
  symbol: string;
  name: string;
  exchange: ExchangeCode;
  quantity: number;
  limitPrice: number;
  targetPrice: number;
}

const krwCurrency = new Intl.NumberFormat("ko-KR", {
  style: "currency",
  currency: "KRW",
  maximumFractionDigits: 0
});

const usdCurrency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2
});

export function OneClickBuyPanel({
  targetProfitPercent,
  usdKrwRate,
  usdKrwUpdatedAt,
  presetSelection,
  onAddFavorite,
  isFavorite,
  onPrecheck,
  onSubmit
}: OneClickBuyPanelProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedResult, setSelectedResult] = useState<SymbolSearchResult | null>(null);
  const [pendingPresetSymbol, setPendingPresetSymbol] = useState<string | null>(null);
  const [confirmationDraft, setConfirmationDraft] = useState<BuyConfirmationDraft | null>(null);
  const [confirmationPrecheck, setConfirmationPrecheck] = useState<OneClickBuyPrecheckResponse | null>(null);
  const [confirmationError, setConfirmationError] = useState<string | null>(null);
  const [exchange, setExchange] = useState<ExchangeCode>("NASD");
  const [quantity, setQuantity] = useState(1);
  const [limitPriceInput, setLimitPriceInput] = useState("");
  const [checkingPrecheck, setCheckingPrecheck] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { results, loading, error: searchError } = useSymbolSearch(
    selectedResult ? "" : searchQuery
  );

  const directTicker = searchQuery.trim().toUpperCase();
  const exactSearchMatch = results.find((result) => result.symbol === directTicker) ?? null;
  const favoriteCandidate = selectedResult ?? exactSearchMatch;
  const selectedSymbol = selectedResult?.symbol ?? directTicker;
  const hasFxRate = usdKrwRate > 0;
  const limitPrice = Number.parseFloat(limitPriceInput);
  const hasValidLimitPrice = Number.isFinite(limitPrice) && limitPrice > 0;
  const perShareKrw = usdKrwRate > 0 && hasValidLimitPrice ? limitPrice * usdKrwRate : 0;
  const totalOrderKrw =
    usdKrwRate > 0 && hasValidLimitPrice && quantity > 0 ? limitPrice * quantity * usdKrwRate : 0;
  const favoriteSaved = favoriteCandidate
    ? isFavorite(favoriteCandidate.symbol, favoriteCandidate.exchange)
    : false;

  const selectResult = (result: SymbolSearchResult) => {
    setSelectedResult(result);
    setSearchQuery(`${result.symbol} | ${result.name}`);
    setExchange(result.exchange);
    setError(null);
  };

  const clearSelection = () => {
    setSelectedResult(null);
    setSearchQuery("");
  };

  const saveFavorite = (result: SymbolSearchResult) => {
    onAddFavorite({
      symbol: result.symbol,
      name: result.name,
      exchange: result.exchange,
      exchangeLabel: result.exchangeLabel
    });
  };

  const closeConfirmation = () => {
    if (submitting) {
      return;
    }

    setConfirmationDraft(null);
    setConfirmationPrecheck(null);
    setConfirmationError(null);
  };

  useEffect(() => {
    if (!presetSelection) {
      return;
    }

    const normalizedPreset = presetSelection.symbol.trim().toUpperCase();

    if (!normalizedPreset) {
      return;
    }

    setSelectedResult(null);
    setSearchQuery(normalizedPreset);
    setPendingPresetSymbol(normalizedPreset);
    setError(null);
    setMessage(null);
    setConfirmationError(null);
  }, [presetSelection]);

  useEffect(() => {
    if (!pendingPresetSymbol || selectedResult || directTicker.length === 0) {
      return;
    }

    if (directTicker !== pendingPresetSymbol) {
      setPendingPresetSymbol(null);
      return;
    }

    if (exactSearchMatch) {
      setPendingPresetSymbol(null);
      setSelectedResult(exactSearchMatch);
      setSearchQuery(`${exactSearchMatch.symbol} | ${exactSearchMatch.name}`);
      setExchange(exactSearchMatch.exchange);
      setError(null);
      return;
    }

    if (results.length > 0) {
      setPendingPresetSymbol(null);
    }
  }, [directTicker, exactSearchMatch, pendingPresetSymbol, results.length, selectedResult]);

  useEffect(() => {
    if (selectedResult || !exactSearchMatch) {
      return;
    }

    setExchange(exactSearchMatch.exchange);
  }, [exactSearchMatch, selectedResult]);

  const buildConfirmationDraft = () => {
    if (!selectedResult && !/^[A-Z][A-Z0-9.-]{0,9}$/.test(directTicker)) {
      setError("종목을 검색해서 선택하거나 정확한 티커 코드를 직접 입력하세요.");
      return null;
    }

    if (quantity <= 0 || !Number.isFinite(quantity)) {
      setError("수량은 1주 이상으로 입력하세요.");
      return null;
    }

    if (!hasValidLimitPrice) {
      setError("매수가를 올바르게 입력하세요.");
      return null;
    }

    const resolvedSymbol = selectedResult?.symbol ?? directTicker;
    const resolvedExchange = selectedResult?.exchange ?? exactSearchMatch?.exchange ?? exchange;
    const resolvedName = selectedResult?.name ?? exactSearchMatch?.name ?? "직접 입력 종목";

    return {
      symbol: resolvedSymbol,
      name: resolvedName,
      exchange: resolvedExchange,
      quantity,
      limitPrice,
      targetPrice: Number((limitPrice * (1 + targetProfitPercent / 100)).toFixed(2))
    } satisfies BuyConfirmationDraft;
  };

  const openConfirmation = async () => {
    const draft = buildConfirmationDraft();

    if (!draft) {
      return;
    }

    setCheckingPrecheck(true);
    setMessage(null);
    setError(null);
    setConfirmationError(null);

    try {
      const precheck = await onPrecheck({
        symbol: draft.symbol,
        exchange: draft.exchange,
        quantity: draft.quantity,
        limitPrice: draft.limitPrice
      });

      setConfirmationDraft(draft);
      setConfirmationPrecheck(precheck);
    } catch (precheckError) {
      setError(precheckError instanceof Error ? precheckError.message : "주문 전 사전체크 실패");
    } finally {
      setCheckingPrecheck(false);
    }
  };

  const submitConfirmed = async () => {
    if (!confirmationDraft) {
      return;
    }

    setSubmitting(true);
    setMessage(null);
    setError(null);
    setConfirmationError(null);

    try {
      const result = await onSubmit({
        symbol: confirmationDraft.symbol,
        exchange: confirmationDraft.exchange,
        quantity: confirmationDraft.quantity,
        limitPrice: confirmationDraft.limitPrice
      });
      setMessage(
        `${result.symbol} ${result.quantity}주 매수 주문 접수, 목표가 $${result.targetPrice.toFixed(2)} 자동매도 등록`
      );
      setConfirmationDraft(null);
      setConfirmationPrecheck(null);
      setConfirmationError(null);
    } catch (submitError) {
      setConfirmationError(submitError instanceof Error ? submitError.message : "원클릭 매수 실패");
    } finally {
      setSubmitting(false);
    }
  };

  const shouldShowSearchResults = !selectedResult && searchQuery.trim().length >= 2;

  return (
    <section className="panel action-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">One Click Buy</p>
          <h2>원클릭 매수</h2>
        </div>
      </div>

      <div className="form-grid">
        <label>
          <span>종목 검색 또는 코드 입력</span>
          <input
            value={searchQuery}
            onChange={(event) => {
              setSearchQuery(event.target.value);
              setSelectedResult(null);
              setPendingPresetSymbol(null);
            }}
            placeholder="예: AAPL, Apple"
          />
          <span className="field-hint">
            두 글자 이상 입력하면 종목 검색이 시작되고, 검색 결과를 누르면 자동으로 채워집니다.
          </span>
        </label>

        {selectedResult ? (
          <div className="selected-symbol-card">
            <div>
              <strong>{selectedResult.symbol}</strong>
              <span>
                {selectedResult.name} · {selectedResult.exchangeLabel}
              </span>
            </div>
            <div className="selected-symbol-actions">
              <button
                type="button"
                className="ghost-button selected-symbol-clear"
                onClick={() => saveFavorite(selectedResult)}
                disabled={favoriteSaved}
              >
                {favoriteSaved ? "즐겨찾기 저장됨" : "즐겨찾기 저장"}
              </button>
              <button type="button" className="ghost-button selected-symbol-clear" onClick={clearSelection}>
                다시 찾기
              </button>
            </div>
          </div>
        ) : null}

        {!selectedResult && exactSearchMatch ? (
          <div className="selected-symbol-card selected-symbol-preview">
            <div>
              <strong>{exactSearchMatch.symbol}</strong>
              <span>
                {exactSearchMatch.name} · {exactSearchMatch.exchangeLabel}
              </span>
            </div>
            <div className="selected-symbol-actions">
              <button
                type="button"
                className="ghost-button selected-symbol-clear"
                onClick={() => saveFavorite(exactSearchMatch)}
                disabled={favoriteSaved}
              >
                {favoriteSaved ? "즐겨찾기 저장됨" : "즐겨찾기 저장"}
              </button>
              <span className="preview-badge">자동 인식됨</span>
            </div>
          </div>
        ) : null}

        {shouldShowSearchResults ? (
          <div className="search-results-shell">
            {loading ? <p className="search-status">종목 검색 중입니다.</p> : null}
            {!loading && results.length > 0 ? (
              <ul className="search-results-list">
                {results.map((result) => (
                  <li key={`${result.exchange}-${result.symbol}`}>
                    <button
                      type="button"
                      className="search-result-button"
                      onClick={() => selectResult(result)}
                    >
                      <strong>{result.symbol}</strong>
                      <span>{result.name}</span>
                      <em>
                        {result.exchangeLabel} · {result.quoteType === "ETF" ? "ETF" : "주식"}
                      </em>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            {!loading && results.length === 0 && !searchError && !/^[A-Z][A-Z0-9.-]{0,9}$/.test(directTicker) ? (
              <p className="search-status">검색 결과에서 종목을 선택하세요.</p>
            ) : null}
            {searchError ? <p className="error-text search-error">{searchError}</p> : null}
          </div>
        ) : null}

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
          <span>매수가</span>
          <div className="input-with-suffix">
            <input
              type="number"
              min={0.01}
              step={0.01}
              value={limitPriceInput}
              onChange={(event) => setLimitPriceInput(event.target.value)}
            />
            <span className="input-suffix">달러</span>
          </div>
          <span className="field-hint price-help-text">
            {hasValidLimitPrice && hasFxRate
              ? `1주당 ${usdCurrency.format(limitPrice)} · 약 ${krwCurrency.format(perShareKrw)} / 총 약 ${krwCurrency.format(totalOrderKrw)}`
              : hasValidLimitPrice
                ? `${usdCurrency.format(limitPrice)} · 환율 불러오는 중`
                : "매수가를 입력하면 현재 환율 기준 한화 금액도 같이 보여줍니다."}
          </span>
          {hasFxRate && usdKrwUpdatedAt ? (
            <span className="field-hint price-help-text">
              환율 기준: 1달러 = {krwCurrency.format(usdKrwRate)} ({new Date(usdKrwUpdatedAt).toLocaleString()} 기준)
            </span>
          ) : null}
        </label>
      </div>

      <div className="panel-footer">
        <div className="status-block">
          <strong>{targetProfitPercent.toFixed(2)}% 자동매도까지 같이 등록</strong>
          <span>실전 계좌 주문 접수 후 이 앱이 등록한 수량만 목표가 도달 시 자동매도합니다.</span>
        </div>
        <button
          className="primary-button"
          onClick={() => {
            void openConfirmation();
          }}
          disabled={submitting || checkingPrecheck || !hasValidLimitPrice || selectedSymbol.length === 0}
        >
          {checkingPrecheck ? "사전체크 중" : submitting ? "접수 중" : "원클릭 매수"}
        </button>
      </div>

      {message ? <p className="success-text">{message}</p> : null}
      {error ? <p className="error-text">{error}</p> : null}
      {confirmationDraft ? (
        <BuyConfirmDialog
          symbol={confirmationDraft.symbol}
          name={confirmationDraft.name}
          exchange={confirmationDraft.exchange}
          quantity={confirmationDraft.quantity}
          limitPrice={confirmationDraft.limitPrice}
          usdKrwRate={usdKrwRate}
          precheck={confirmationPrecheck}
          targetProfitPercent={targetProfitPercent}
          targetPrice={confirmationDraft.targetPrice}
          submitting={submitting}
          errorMessage={confirmationError}
          onCancel={closeConfirmation}
          onConfirm={() => void submitConfirmed()}
        />
      ) : null}
    </section>
  );
}
