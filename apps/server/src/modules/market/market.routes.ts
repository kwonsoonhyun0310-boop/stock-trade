import { Router } from "express";
import { asyncHandler } from "../../lib/async-handler.js";
import type { MarketAnalysisService } from "./market-analysis.service.js";

export const createMarketRouter = (marketAnalysisService: MarketAnalysisService) => {
  const router = Router();

  router.get(
    "/dashboard",
    asyncHandler(async (request, response) => {
      const forceRefresh = request.query.refresh === "true";
      const dashboard = await marketAnalysisService.getDashboard(forceRefresh);
      response.json(dashboard);
    })
  );

  return router;
};
