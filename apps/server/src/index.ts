import { env } from "./config/env.js";
import { CodexCliProvider } from "./integrations/ai/codex-cli-provider.js";
import { KisClient } from "./integrations/kis/kis-client.js";
import { logger } from "./lib/logger.js";
import { MarketAnalysisService } from "./modules/market/market-analysis.service.js";
import { MarketDataService } from "./modules/market/market-data.service.js";
import { SymbolSearchService } from "./modules/market/symbol-search.service.js";
import { TradingService } from "./modules/trading/trading.service.js";
import { createServer } from "./server.js";

const bootstrap = async () => {
  const kisClient = new KisClient();
  const codexCliProvider = new CodexCliProvider();
  const tradingService = new TradingService(kisClient);
  const marketDataService = new MarketDataService();
  const marketAnalysisService = new MarketAnalysisService(marketDataService, codexCliProvider);
  const symbolSearchService = new SymbolSearchService();

  await tradingService.init();

  const app = createServer(tradingService, marketAnalysisService, codexCliProvider, symbolSearchService);

  app.listen(env.PORT, () => {
    logger.info(`Server listening on http://localhost:${env.PORT}`);
  });
};

void bootstrap();
