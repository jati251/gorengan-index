import { EventEmitter } from "node:events";
import type { Candle, NormalizedTrade, Timeframe } from "@gorengan/shared";
import type { CandleRepository } from "../persistence/candle-repository.js";
import { logger } from "../utils/logger.js";

export interface CandleEngineEvents {
  "candle:update": (candle: Candle) => void;
  "candle:finalized": (candle: Candle) => void;
}

export class CandleEngine extends EventEmitter {
  private repository: CandleRepository;
  // Map key: "symbol:1m"
  private activeCandles = new Map<string, Candle>();
  private checkInterval: NodeJS.Timeout | null = null;

  constructor(repository: CandleRepository) {
    super();
    this.repository = repository;
    this.startBoundaryChecker();
  }

  public processTrade(trade: NormalizedTrade): void {
    const key = this.getMapKey(trade.symbol, "1m");
    const bucketOpen = Math.floor(trade.timestamp / 60000) * 60000;
    const bucketClose = bucketOpen + 60000 - 1;

    let current = this.activeCandles.get(key);

    // If an existing candle exists and belongs to a previous minute bucket, finalize it
    if (current && current.openTime < bucketOpen) {
      this.finalizeCandle(current);
      current = undefined;
    }

    if (!current) {
      current = {
        symbol: trade.symbol,
        timeframe: "1m",
        openTime: bucketOpen,
        closeTime: bucketClose,
        open: trade.price,
        high: trade.price,
        low: trade.price,
        close: trade.price,
        volume: trade.quantity,
        trades: 1,
        finalized: false,
        provider: trade.provider,
      };
      this.activeCandles.set(key, current);
    } else {
      current.high = Math.max(current.high, trade.price);
      current.low = Math.min(current.low, trade.price);
      current.close = trade.price;
      current.volume += trade.quantity;
      current.trades = (current.trades ?? 0) + 1;
    }

    // Emit live candle update
    this.emit("candle:update", { ...current });
  }

  public getCurrentCandle(symbol: string, timeframe: Timeframe = "1m"): Candle | null {
    const key = this.getMapKey(symbol, timeframe);
    const candle = this.activeCandles.get(key);
    return candle ? { ...candle } : null;
  }

  public getAllCurrentCandles(): Record<string, Candle> {
    const result: Record<string, Candle> = {};
    for (const [key, c] of this.activeCandles.entries()) {
      result[key] = { ...c };
    }
    return result;
  }

  public stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    // Flush remaining open candles
    for (const candle of this.activeCandles.values()) {
      this.finalizeCandle(candle);
    }
    this.activeCandles.clear();
  }

  private finalizeCandle(candle: Candle): void {
    candle.finalized = true;

    try {
      this.repository.saveCandle(candle);
      this.emit("candle:finalized", { ...candle });
    } catch (err) {
      logger.error(
        { err, symbol: candle.symbol, openTime: candle.openTime },
        "Error persisting finalized candle"
      );
    }
  }

  private startBoundaryChecker(): void {
    // Check every second for minute rollover
    this.checkInterval = setInterval(() => {
      const now = Date.now();
      const currentBucketOpen = Math.floor(now / 60000) * 60000;

      for (const [key, candle] of this.activeCandles.entries()) {
        if (candle.openTime < currentBucketOpen) {
          this.finalizeCandle(candle);
          this.activeCandles.delete(key);
        }
      }
    }, 1000);
  }

  private getMapKey(symbol: string, timeframe: Timeframe): string {
    return `${symbol}:${timeframe}`;
  }
}
