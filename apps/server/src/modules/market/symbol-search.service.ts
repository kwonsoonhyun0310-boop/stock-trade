import YahooFinance from "yahoo-finance2";
import type { ExchangeCode, SymbolSearchResult } from "@trade/shared";

const financeApi = new (YahooFinance as any)({
  suppressNotices: ["yahooSurvey", "ripHistorical"]
});

interface YahooSearchQuote {
  symbol?: string;
  shortname?: string;
  longname?: string;
  exchange?: string;
  exchDisp?: string;
  quoteType?: string;
  isYahooFinance?: boolean;
}

const toExchangeCode = (exchange?: string, exchangeLabel?: string): ExchangeCode | null => {
  const value = `${exchange ?? ""} ${exchangeLabel ?? ""}`.toUpperCase();

  if (
    value.includes("NASDAQ") ||
    value.includes(" NMS") ||
    value.includes(" NGM") ||
    value.includes(" NCM") ||
    value.includes(" NAS")
  ) {
    return "NASD";
  }

  if (
    value.includes("NYSE ARCA") ||
    value.includes("NYSEAMERICAN") ||
    value.includes("NYSE AMERICAN") ||
    value.includes("AMEX") ||
    value.includes(" ARCX") ||
    value.includes(" ASE") ||
    value.includes(" PCX")
  ) {
    return "AMEX";
  }

  if (value.includes("NYSE") || value.includes(" NYQ")) {
    return "NYSE";
  }

  return null;
};

const toExchangeLabel = (exchange: ExchangeCode) => {
  switch (exchange) {
    case "NASD":
      return "NASDAQ";
    case "NYSE":
      return "NYSE";
    case "AMEX":
      return "AMEX";
  }
};

const isSupportedQuote = (quote: YahooSearchQuote) =>
  quote.isYahooFinance === true &&
  typeof quote.symbol === "string" &&
  /^[A-Z][A-Z0-9.-]{0,9}$/.test(quote.symbol) &&
  (quote.quoteType === "EQUITY" || quote.quoteType === "ETF");

export class SymbolSearchService {
  async search(query: string): Promise<SymbolSearchResult[]> {
    const trimmed = query.trim();

    if (trimmed.length < 1) {
      return [];
    }

    const response = (await financeApi.search(trimmed, {
      quotesCount: 10,
      newsCount: 0,
      region: "US",
      lang: "en-US",
      enableFuzzyQuery: true
    })) as { quotes?: YahooSearchQuote[] };

    const seen = new Set<string>();

    return (response.quotes ?? [])
      .filter(isSupportedQuote)
      .flatMap((quote) => {
        const exchange = toExchangeCode(quote.exchange, quote.exchDisp);

        if (!exchange || seen.has(quote.symbol!)) {
          return [];
        }

        seen.add(quote.symbol!);

        return [
          {
            symbol: quote.symbol!,
            name: quote.longname || quote.shortname || quote.symbol!,
            exchange,
            exchangeLabel: toExchangeLabel(exchange),
            quoteType: quote.quoteType as "EQUITY" | "ETF"
          }
        ];
      });
  }
}
