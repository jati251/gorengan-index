import { EventEmitter } from "node:events";
import type { Candle, NormalizedTrade, Timeframe } from "@gorengan/shared";
import type { CandleRepository } from "../persistence/candle-repository.js";
import { logger } from "../utils/logger.js";

export interface CandleEngineEvents {
  "candle:update": (candle: Candle) => void;
  "candle:finalized": (candle: Candle) => void;
}

const LIVE_BUCKETS: ReadonlyArray<{ readonly timeframe: Timeframe; readonly durationMs: number }> = [
  { timeframe: "1s", durationMs: 1_000 },
  { timeframe: "5s", durationMs: 5_000 },
  { timeframe: "15s", durationMs: 15_000 },
  { timeframe: "30s", durationMs: 30_000 },
  { timeframe: "1m", durationMs: 60_000 },
  { timeframe: "5m", durationMs: 300_000 },
  { timeframe: "15m", durationMs: 900_000 },
  { timeframe: "30m", durationMs: 1_800_000 },
  { timeframe: "1h", durationMs: 3_600_000 },
  { timeframe: "4h", durationMs: 14_400_000 },
  { timeframe: "1d", durationMs: 86_400_000 },
];

export class CandleEngine extends EventEmitter {
  private repository: CandleRepository;
  // Map key: "symbol:timeframe"
  private activeCandles = new Map<string, Candle>();
  private lastTradeTimes = new Map<string, number>();
  private checkInterval: NodeJS.Timeout | null = null;

  constructor(repository: CandleRepository) {
    super();
    this.repository = repository;
    this.startBoundaryChecker();
  }

  public processTrade(trade: NormalizedTrade): void {
    if (
      ![trade.price, trade.quantity, trade.timestamp].every(Number.isFinite) ||
      trade.price <= 0 ||
      trade.quantity <= 0 ||
      trade.timestamp < 0 ||
      trade.timestamp > Date.now() + 5000
    ) {
      return;
    }
    const previousTime = this.lastTradeTimes.get(trade.symbol);
    if (previousTime !== undefined && trade.timestamp < previousTime) return;
    this.lastTradeTimes.set(trade.symbol, trade.timestamp);

    for (let i = 0; i < LIVE_BUCKETS.length; i++) {
      const { timeframe, durationMs } = LIVE_BUCKETS[i];
      this.updateTimeframeBucket(trade, timeframe, durationMs);
    }
  }

  private updateTimeframeBucket(
    trade: NormalizedTrade,
    timeframe: Timeframe,
    durationMs: number
  ): void {
    const key = this.getMapKey(trade.symbol, timeframe);
    const bucketOpen = Math.floor(trade.timestamp / durationMs) * durationMs;
    const bucketClose = bucketOpen + durationMs - 1;

    let current = this.activeCandles.get(key);

    // If an existing candle exists and belongs to a previous bucket, finalize it
    if (current && current.openTime < bucketOpen) {
      this.finalizeCandle(current);
      current = undefined;
    }

    if (!current) {
      const seeded =
        timeframe !== "1s" && this.repository.getExactCacheCount(trade.symbol, timeframe) > 0
          ? this.repository.getLatestCandle(trade.symbol, timeframe)
          : null;

      if (seeded && seeded.openTime === bucketOpen) {
        current = {
          ...seeded,
          high: Math.max(seeded.high, trade.price),
          low: Math.min(seeded.low, trade.price),
          close: trade.price,
          volume: seeded.volume + trade.quantity,
          trades: (seeded.trades ?? 0) + 1,
          finalized: false,
          provider: trade.provider,
        };
      } else {
        current = {
          symbol: trade.symbol,
          timeframe,
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
      }
      this.activeCandles.set(key, current);
    } else {
      if (trade.price > current.high) current.high = trade.price;
      if (trade.price < current.low) current.low = trade.price;
      current.close = trade.price;
      current.volume += trade.quantity;
      current.trades = (current.trades ?? 0) + 1;
    }

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
      if (
        candle.timeframe === "1m" ||
        candle.timeframe === "1s" ||
        this.repository.getExactCacheCount(candle.symbol, candle.timeframe) > 0
      ) {
        this.repository.saveCandle(candle);
      }
      this.emit("candle:finalized", { ...candle });
    } catch (err) {
      logger.error(
        { err, symbol: candle.symbol, openTime: candle.openTime },
        "Error persisting finalized candle"
      );
    }
  }

  private startBoundaryChecker(): void {
    // Check every second for bucket rollover across active timeframes
    this.checkInterval = setInterval(() => {
      const now = Date.now();

      for (const [key, candle] of this.activeCandles.entries()) {
        if (now > candle.closeTime) {
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
