import type { Candle, Timeframe, MarketSymbol } from "@gorengan/shared";
import { DEFAULT_SYMBOLS, timeframeToMs } from "@gorengan/shared";
import { getDatabase, type QuestDbClient } from "./database.js";
import { logger } from "../utils/logger.js";

export class CandleRepository {
  private db: QuestDbClient;
  private candleCache = new Map<string, Candle[]>();
  private symbols: MarketSymbol[] = DEFAULT_SYMBOLS;

  constructor(db?: QuestDbClient) {
    this.db = db || getDatabase();
  }

  public getSymbols(): MarketSymbol[] {
    return this.symbols;
  }

  public saveCandle(candle: Candle): void {
    const key = `${candle.symbol}:1m`;
    let list = this.candleCache.get(key);
    if (!list) {
      list = [];
      this.candleCache.set(key, list);
    }
    const idx = list.findIndex((c) => c.openTime === candle.openTime);
    if (idx >= 0) {
      list[idx] = candle;
    } else {
      list.push(candle);
      list.sort((a, b) => a.openTime - b.openTime);
      if (list.length > 2000) {
        list.splice(0, list.length - 2000);
      }
    }

    // Persist to QuestDB asynchronously via ILP
    const tsNs = candle.openTime * 1_000_000;
    const line = `candles_1m,instrument=${candle.symbol},provider=${candle.provider || "default"} open=${candle.open},high=${candle.high},low=${candle.low},close=${candle.close},volume=${candle.volume},trade_count=${candle.trades ?? 0}i ${tsNs}`;
    this.db.writeIlp([line]).catch((err) => {
      logger.debug({ err: (err as Error).message, symbol: candle.symbol }, "QuestDB ILP write notice");
    });
  }

  public saveCandles(candles: Candle[]): void {
    for (const c of candles) {
      this.saveCandle(c);
    }
  }

  public getLatestCandle(symbol: string, timeframe: Timeframe = "1m"): Candle | null {
    const candles = this.getCandles(symbol, timeframe, undefined, undefined, 1);
    return candles.length > 0 ? candles[candles.length - 1] : null;
  }

  public getCandles(
    symbol: string,
    timeframe: Timeframe = "1m",
    from?: number,
    to?: number,
    limit: number = 500
  ): Candle[] {
    const key = `${symbol}:1m`;
    const list = this.candleCache.get(key) || [];
    let filtered = list;

    if (from !== undefined) {
      filtered = filtered.filter((c) => c.openTime >= from);
    }
    if (to !== undefined) {
      filtered = filtered.filter((c) => c.openTime <= to);
    }

    if (timeframe === "1m") {
      return filtered.slice(-limit);
    }

    const bucketMs = timeframeToMs(timeframe);
    return this.aggregateCandles(filtered, timeframe, bucketMs).slice(-limit);
  }

  private aggregateCandles(
    oneMinuteCandles: Candle[],
    targetTimeframe: Timeframe,
    bucketMs: number
  ): Candle[] {
    if (oneMinuteCandles.length === 0) return [];

    const buckets = new Map<number, Candle[]>();

    for (const c of oneMinuteCandles) {
      const bucketOpen = Math.floor(c.openTime / bucketMs) * bucketMs;
      let list = buckets.get(bucketOpen);
      if (!list) {
        list = [];
        buckets.set(bucketOpen, list);
      }
      list.push(c);
    }

    const aggregated: Candle[] = [];

    for (const [bucketOpen, list] of buckets.entries()) {
      if (list.length === 0) continue;
      const sorted = list.sort((a, b) => a.openTime - b.openTime);
      const first = sorted[0];
      const last = sorted[sorted.length - 1];

      let high = first.high;
      let low = first.low;
      let volume = 0;
      let trades = 0;

      for (const item of sorted) {
        if (item.high > high) high = item.high;
        if (item.low < low) low = item.low;
        volume += item.volume;
        trades += item.trades ?? 0;
      }

      aggregated.push({
        symbol: first.symbol,
        timeframe: targetTimeframe,
        openTime: bucketOpen,
        closeTime: bucketOpen + bucketMs - 1,
        open: first.open,
        high,
        low,
        close: last.close,
        volume,
        trades,
        finalized: true,
        provider: first.provider,
      });
    }

    return aggregated.sort((a, b) => a.openTime - b.openTime);
  }

  public pruneOldCandles(cutoffMs: number): number {
    let removed = 0;
    for (const [key, list] of this.candleCache.entries()) {
      const beforeLen = list.length;
      const filtered = list.filter((c) => c.openTime >= cutoffMs);
      this.candleCache.set(key, filtered);
      removed += beforeLen - filtered.length;
    }
    return removed;
  }
}
