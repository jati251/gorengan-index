import type { CandleRepository } from "../persistence/candle-repository.js";
import type { MarketProvider } from "../providers/market-provider.js";
import { logger } from "../utils/logger.js";

export async function runBackfill(
  repository: CandleRepository,
  provider: MarketProvider,
  symbols: string[]
): Promise<void> {
  logger.info({ symbolsCount: symbols.length }, "Starting historical gap backfill");

  const now = Date.now();

  for (const symbol of symbols) {
    try {
      const latest = repository.getLatestCandle(symbol, "1m");
      let from: number;

      if (latest) {
        from = latest.openTime + 60000;
      } else {
        // If empty DB, backfill last 24 hours (1440 bars)
        from = now - 24 * 60 * 60 * 1000;
      }

      if (now - from < 60000) {
        // Less than 1 minute gap, no backfill needed
        continue;
      }

      logger.info(
        { symbol, gapMinutes: Math.round((now - from) / 60000) },
        "Fetching historical gap backfill from provider"
      );

      const candles = await provider.getHistoricalCandles({
        symbol,
        timeframe: "1m",
        from,
        to: now,
      });

      if (candles.length > 0) {
        repository.saveCandles(candles);
        logger.info(
          { symbol, backfilledBars: candles.length },
          "Successfully backfilled historical candles"
        );
      }
    } catch (err) {
      logger.error({ err, symbol }, "Failed to backfill gap for symbol");
    }
  }
}

export function runRetentionJob(
  repository: CandleRepository,
  retentionDays: number = 90
): void {
  const cutoffMs = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  try {
    const deletedCount = repository.pruneOldCandles(cutoffMs);
    logger.info(
      { deletedCount, retentionDays },
      "Completed daily candle retention cleanup"
    );
  } catch (err) {
    logger.error({ err }, "Retention cleanup error");
  }
}
