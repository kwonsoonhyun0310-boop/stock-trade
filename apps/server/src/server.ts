import cors from "cors";
import express from "express";
import type { DashboardResponse } from "@trade/shared";
import { env } from "./config/env.js";
import { asyncHandler } from "./lib/async-handler.js";
import { createMarketRouter } from "./modules/market/market.routes.js";
import type { MarketAnalysisService } from "./modules/market/market-analysis.service.js";
import type { SymbolSearchService } from "./modules/market/symbol-search.service.js";
import type { WatchlistMonitorService } from "./modules/market/watchlist-monitor.service.js";
import { createTradingRouter } from "./modules/trading/trading.routes.js";
import type { TradingService } from "./modules/trading/trading.service.js";
import type { CodexCliProvider } from "./integrations/ai/codex-cli-provider.js";

export const createServer = (
  tradingService: TradingService,
  marketAnalysisService: MarketAnalysisService,
  codexCliProvider: CodexCliProvider,
  symbolSearchService: SymbolSearchService,
  watchlistMonitorService: WatchlistMonitorService
) => {
  const app = express();

  app.use(
    cors({
      origin: env.FRONTEND_ORIGIN,
      credentials: true
    })
  );
  app.use(express.json());

  app.get("/api/health", (_request, response) => {
    response.json({ ok: true, timestamp: new Date().toISOString() });
  });

  app.get(
    "/api/dashboard",
    asyncHandler(async (_request, response) => {
      const [trading, market, loginStatus] = await Promise.all([
        Promise.resolve(tradingService.getStatus()),
        marketAnalysisService.getDashboard(),
        codexCliProvider.getLoginStatus()
      ]);

      const payload: DashboardResponse = {
        trading,
        market,
        llm: {
          provider: "codex-cli",
          model: env.CODEX_MODEL,
          loginStatus
        }
      };

      response.json(payload);
    })
  );

  app.use("/api/trading", createTradingRouter(tradingService));
  app.use(
    "/api/market",
    createMarketRouter(marketAnalysisService, symbolSearchService, watchlistMonitorService)
  );

  app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
    response.status(500).json({
      message: error instanceof Error ? error.message : "Unexpected server error"
    });
  });

  return app;
};
