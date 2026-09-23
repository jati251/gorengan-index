import { config } from "./config/index.js";
import { logger } from "./utils/logger.js";
import { getDatabase, closeDatabase } from "./persistence/database.js";
import { CandleRepository } from "./persistence/candle-repository.js";
import { MarketState } from "./market/market-state.js";
import { CandleEngine } from "./market/candle-engine.js";
import { CompositeMarketProvider } from "./providers/composite/composite-provider.js";
import { createHttpServer } from "./transport/http/server.js";
import { MarketWebSocketGateway } from "./transport/websocket/gateway.js";
import { runBackfill, runRetentionJob } from "./jobs/backfill.js";

async function bootstrap() {
  logger.info("==================================================");
  logger.info("Starting Gorengan Realtime Investment Terminal");
  logger.info({ port: config.PORT, host: config.HOST }, "Bootstrapping market-server");
  logger.info("==================================================");

  // 1. Initialize QuestDB storage
  const db = getDatabase();
  const repository = new CandleRepository(db);

  // 2. Initialize in-memory state and engines
  const marketState = new MarketState();
  const candleEngine = new CandleEngine(repository);

  // 4. Symbols
  const allSymbols = repository.getSymbols();
  const symbols = allSymbols.map((s) => s.id);
  logger.info({ symbolsCount: symbols.length }, "Configured symbols for ingestion");

  // 5. Initialize Composite provider (Binance for Crypto + Yahoo for Equities/Forex)
  const provider = new CompositeMarketProvider(allSymbols);

  // 5. Create HTTP Server & WebSocket Gateway
  const httpServer = createHttpServer(
    repository,
    marketState,
    candleEngine,
    provider
  );
  const wsGateway = new MarketWebSocketGateway(
    httpServer,
    marketState,
    candleEngine
  );

  // 6. Connect event pipeline
  provider.on("ticker", (ticker) => {
    marketState.setTicker(ticker);
    wsGateway.publishTicker(ticker);
  });

  provider.on("trade", (trade) => {
    candleEngine.processTrade(trade);
  });

  candleEngine.on("candle:update", (candle) => {
    wsGateway.publishCandle(candle);
  });

  candleEngine.on("candle:finalized", (candle) => {
    wsGateway.publishCandle(candle);
  });

  provider.on("status", (status) => {
    marketState.setProviderStatus(
      status.provider,
      status.connected,
      status.status,
      status.lastEventAt,
      status.subscribedSymbols
    );
    const msg = marketState.getProviderStatus(status.provider);
    if (msg) wsGateway.publishStatus(msg);
  });

  provider.on("error", (err) => {
    logger.warn({ err: err.message }, "Market provider reported connection error; reconnect loop active");
  });

  // 7. Start listening
  await new Promise<void>((resolve) => {
    httpServer.listen(config.PORT, config.HOST, () => {
      logger.info(
        `Market Server running on http://${config.HOST}:${config.PORT} (WebSocket at /ws)`
      );
      resolve();
    });
  });

  // 8. Gap backfill
  try {
    await runBackfill(repository, provider, symbols);
  } catch (err) {
    logger.warn({ err }, "Initial backfill failed or partially completed, continuing startup");
  }

  // 9. Connect realtime feed
  await provider.connect();

  // 10. Schedule retention job (runs once every 24 hours)
  const retentionInterval = setInterval(() => {
    runRetentionJob(repository, config.RETENTION_1M_DAYS);
  }, 24 * 60 * 60 * 1000);

  // 11. Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info({ signal }, "Received shutdown signal, terminating gracefully");
    clearInterval(retentionInterval);

    try {
      await provider.disconnect();
      candleEngine.stop();
      wsGateway.close();
      httpServer.close();
      closeDatabase();
      logger.info("Graceful shutdown complete");
      process.exit(0);
    } catch (err) {
      logger.error({ err }, "Error during graceful shutdown");
      process.exit(1);
    }
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

bootstrap().catch((err) => {
  logger.error({ err }, "Fatal bootstrap error in market-server");
  process.exit(1);
});
