import type { TradingStatus } from "@trade/shared";

export interface ProfitSummarySnapshot {
  unrealizedProfitUsd: number;
  evaluatedAmountUsd: number;
  weightedProfitPercent: number;
}

export const deriveProfitSummary = (trading: TradingStatus): ProfitSummarySnapshot => {
  const unrealizedProfitUsd = trading.holdings.reduce(
    (sum, holding) => sum + holding.profitAmount,
    0
  );
  const evaluatedAmountUsd = trading.holdings.reduce(
    (sum, holding) => sum + holding.evaluatedAmount,
    0
  );
  const totalCostBasisUsd = trading.holdings.reduce(
    (sum, holding) => sum + Math.max(0, holding.evaluatedAmount - holding.profitAmount),
    0
  );

  return {
    unrealizedProfitUsd,
    evaluatedAmountUsd,
    weightedProfitPercent: totalCostBasisUsd > 0 ? (unrealizedProfitUsd / totalCostBasisUsd) * 100 : 0
  };
};
