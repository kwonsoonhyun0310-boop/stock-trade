import { z } from "zod";
import { Router } from "express";
import { asyncHandler } from "../../lib/async-handler.js";
import type { MarketAnalysisService } from "./market-analysis.service.js";
import type { SymbolSearchService } from "./symbol-search.service.js";

export const createMarketRouter = (
  marketAnalysisService: MarketAnalysisService,
  symbolSearchService: SymbolSearchService
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

  return router;
};
