import { z } from "zod";
import { Router } from "express";
import { asyncHandler } from "../../lib/async-handler.js";
import type { MarketAnalysisService } from "./market-analysis.service.js";
import type { SymbolSearchService } from "./symbol-search.service.js";
import type { WatchlistMonitorService } from "./watchlist-monitor.service.js";

const watchlistRequestSchema = z.object({
  favorites: z.array(
    z.object({
      symbol: z.string().trim().min(1).max(10),
      name: z.string().trim().min(1).max(120),
      exchange: z.enum(["NASD", "NYSE", "AMEX"]),
      exchangeLabel: z.string().trim().min(1).max(20)
    })
  )
});

export const createMarketRouter = (
  marketAnalysisService: MarketAnalysisService,
  symbolSearchService: SymbolSearchService,
  watchlistMonitorService: WatchlistMonitorService
) => {
  const router = Router();

  router.get(
    "/dashboard",
    asyncHandler(async (request, response) => {
      const forceRefresh = request.query.refresh === "true";
      const dashboard = await marketAnalysisService.getDashboard(forceRefresh);
      response.json(dashboard);
    })
  );

  router.get(
    "/symbol-search",
    asyncHandler(async (request, response) => {
      const query = z.string().trim().min(1).max(50).parse(request.query.q);
      const results = await symbolSearchService.search(query);
      response.json(results);
    })
  );

  router.post(
    "/watchlist/quotes",
    asyncHandler(async (request, response) => {
      const payload = watchlistRequestSchema.parse(request.body);
      const snapshot = await watchlistMonitorService.getSnapshot(payload.favorites);
      response.json(snapshot);
    })
  );

  return router;
};
