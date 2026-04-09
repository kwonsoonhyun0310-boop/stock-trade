import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../lib/async-handler.js";
import type { TradingService } from "./trading.service.js";

const updateSettingsSchema = z.object({
  enabled: z.boolean().optional(),
  targetProfitPercent: z.number().min(0.1).max(100).optional(),
  pollIntervalMs: z.number().min(5_000).max(60 * 60 * 1000).optional(),
  watchSymbols: z.array(z.string()).optional()
});

const manualOrderSchema = z.object({
  side: z.enum(["buy", "sell"]),
  symbol: z.string().min(1).max(10),
  exchange: z.enum(["NASD", "NYSE", "AMEX"]),
  quantity: z.number().int().positive(),
  limitPrice: z.number().positive()
});

export const createTradingRouter = (tradingService: TradingService) => {
  const router = Router();

  router.get(
    "/status",
    asyncHandler(async (_request, response) => {
      response.json(tradingService.getStatus());
    })
  );

  router.post(
    "/settings",
    asyncHandler(async (request, response) => {
      const payload = updateSettingsSchema.parse(request.body);
      const result = await tradingService.updateSettings(payload);
      response.json(result);
    })
  );

  router.post(
    "/refresh",
    asyncHandler(async (_request, response) => {
      const result = await tradingService.refreshNow();
      response.json(result);
    })
  );

  router.post(
    "/order",
    asyncHandler(async (request, response) => {
      const payload = manualOrderSchema.parse(request.body);
      const result = await tradingService.submitManualOrder(payload);
      response.json(result);
    })
  );

  return router;
};
