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

const oneClickBuySchema = z.object({
  symbol: z.string().min(1).max(10),
  exchange: z.enum(["NASD", "NYSE", "AMEX"]),
  quantity: z.number().int().positive(),
  limitPrice: z.number().positive()
});

const modifyBuyOrderSchema = z.object({
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
    "/profit-ledger/backfill",
    asyncHandler(async (_request, response) => {
      const result = await tradingService.backfillProfitLedgerHistory(true);
      response.json(result);
    })
  );

  router.post(
    "/one-click-buy/precheck",
    asyncHandler(async (request, response) => {
      const payload = oneClickBuySchema.parse(request.body);
      const result = await tradingService.precheckOneClickBuy(payload);
      response.json(result);
    })
  );

  router.post(
    "/one-click-buy",
    asyncHandler(async (request, response) => {
      const payload = oneClickBuySchema.parse(request.body);
      const result = await tradingService.submitOneClickBuy(payload);
      response.json(result);
    })
  );

  router.post(
    "/targets/:targetId/cancel",
    asyncHandler(async (request, response) => {
      const targetId = z.string().uuid().parse(request.params.targetId);
      const result = await tradingService.cancelAutoSellTarget(targetId);
      response.json(result);
    })
  );

  router.post(
    "/targets/:targetId/buy-order/modify",
    asyncHandler(async (request, response) => {
      const targetId = z.string().uuid().parse(request.params.targetId);
      const payload = modifyBuyOrderSchema.parse(request.body);
      const result = await tradingService.modifyBuyOrder(targetId, payload.limitPrice);
      response.json(result);
    })
  );

  router.post(
    "/targets/:targetId/buy-order/cancel",
    asyncHandler(async (request, response) => {
      const targetId = z.string().uuid().parse(request.params.targetId);
      const result = await tradingService.cancelBuyOrder(targetId);
      response.json(result);
    })
  );

  return router;
};
