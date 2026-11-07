import type { Candle, Timeframe, MarketSymbol } from "@gorengan/shared";
import { DEFAULT_SYMBOLS, timeframeToMs } from "@gorengan/shared";
import { getDatabase, type QuestDbClient } from "./database.js";
import { getPostgresPool } from "./postgres.js";
import { logger } from "../utils/logger.js";

export class CandleRepository {
  private db: QuestDbClient;
  private candleCache = new Map<string, Candle[]>();
  private cacheUpdatedAt = new Map<string, number>();
  private historySyncedAt = new Map<string, number>();
  private symbols: MarketSymbol[] = DEFAULT_SYMBOLS;

  constructor(db?: QuestDbClient) {
    this.db = db || getDatabase();
  }

  public get databaseConnected(): boolean { return this.db.connected; }

  public getCacheAgeMs(symbol: string, timeframe: Timeframe): number {
    const updatedAt = this.cacheUpdatedAt.get(`${symbol}:${timeframe}`);
    return updatedAt === undefined ? Number.POSITIVE_INFINITY : Date.now() - updatedAt;
  }

  public getHistorySyncAgeMs(symbol: string, timeframe: Timeframe): number {
    const syncedAt = this.historySyncedAt.get(`${symbol}:${timeframe}`);
    return syncedAt === undefined ? Number.POSITIVE_INFINITY : Date.now() - syncedAt;
  }

  public getExactCacheCount(symbol: string, timeframe: Timeframe): number {
    return this.candleCache.get(`${symbol}:${timeframe}`)?.length ?? 0;
  }

  public getSymbols(): MarketSymbol[] {
    return this.symbols;
  }

  public setSymbols(symbols: MarketSymbol[]): void {
    this.symbols = symbols;
  }

  public async loadSymbolsFromDatabase(): Promise<MarketSymbol[]> {
    const pool = getPostgresPool();
    if (!pool) {
      logger.info("DATABASE_URL not configured, using fallback default symbols");
      return this.symbols;
    }

    try {
      const res = await pool.query(
        "SELECT * FROM market_symbols WHERE enabled = true ORDER BY asset_class, id ASC"
      );

      if (res.rows.length > 0) {
        const loaded: MarketSymbol[] = res.rows.map((row) => ({
          id: row.id,
          base: row.base,
          quote: row.quote,
          assetClass: row.asset_class,
          provider: row.provider,
          providerSymbol: row.provider_symbol,
          name: row.name,
          enabled: row.enabled,
          isTokenizedMetal: row.is_tokenized_metal ?? false,
          pipSize: row.pip_size != null ? Number(row.pip_size) : undefined,
          displayDecimals: row.display_decimals != null ? Number(row.display_decimals) : undefined,
          candlePriceBasis: row.candle_price_basis ?? "trade",
          exchange: row.exchange ?? undefined,
          country: row.country ?? undefined,
          timezone: row.timezone ?? undefined,
        }));
        this.symbols = loaded;
        logger.info({ count: loaded.length }, "Loaded dynamic market symbols from PostgreSQL");
        return this.symbols;
      }
    } catch (err) {
      logger.warn({ err: (err as Error).message }, "Could not load symbols from PostgreSQL, using fallback default symbols");
    }
    return this.symbols;
  }

  private upsertCandleInMemory(candle: Candle): void {
    const key = `${candle.symbol}:${candle.timeframe}`;
    let list = this.candleCache.get(key);
    if (!list) {
      list = [candle];
      this.candleCache.set(key, list);
      this.cacheUpdatedAt.set(key, Date.now());
      return;
    }

    const len = list.length;
    if (len === 0) {
      list.push(candle);
    } else {
      const last = list[len - 1];
      if (candle.openTime > last.openTime) {
        list.push(candle);
      } else if (candle.openTime === last.openTime) {
        list[len - 1] = candle;
      } else {
        // Binary search for insertion / replacement index
        let lo = 0;
        let hi = len - 1;
        while (lo <= hi) {
          const mid = (lo + hi) >>> 1;
          const midOpen = list[mid].openTime;
          if (midOpen === candle.openTime) {
            list[mid] = candle;
            this.cacheUpdatedAt.set(key, Date.now());
            return;
          }
          if (midOpen < candle.openTime) {
            lo = mid + 1;
          } else {
            hi = mid - 1;
          }
        }
        list.splice(lo, 0, candle);
      }
    }

    if (list.length > 2000) {
      list.splice(0, list.length - 2000);
    }
    this.cacheUpdatedAt.set(key, Date.now());
  }

  private formatIlpLine(candle: Candle): string {
    const tsNs = candle.openTime * 1_000_000;
    return `candles_1m,instrument=${candle.symbol},provider=${candle.provider || "default"} open=${candle.open},high=${candle.high},low=${candle.low},close=${candle.close},volume=${candle.volume},trade_count=${candle.trades ?? 0}i ${tsNs}`;
  }

  public saveCandle(candle: Candle): void {
    this.upsertCandleInMemory(candle);

    if (candle.timeframe !== "1m") return;

    // Persist to QuestDB asynchronously via ILP
    const line = this.formatIlpLine(candle);
    this.db.writeIlp([line]).catch((err) => {
      logger.debug({ err: (err as Error).message, symbol: candle.symbol }, "QuestDB ILP write notice");
    });
  }

  public saveCandles(candles: Candle[]): void {
    if (candles.length === 0) return;
    const now = Date.now();
    const syncedCounts = new Map<string, number>();
    const ilpLines: string[] = [];
    for (let i = 0; i < candles.length; i++) {
      const c = candles[i];
      this.upsertCandleInMemory(c);
      const key = `${c.symbol}:${c.timeframe}`;
      syncedCounts.set(key, (syncedCounts.get(key) ?? 0) + 1);
      if (c.timeframe === "1m") {
        ilpLines.push(this.formatIlpLine(c));
      }
    }
    for (const [key, count] of syncedCounts.entries()) {
      if (count >= 10) {
        this.historySyncedAt.set(key, now);
      }
    }
    if (ilpLines.length > 0) {
      this.db.writeIlp(ilpLines).catch((err) => {
        logger.debug({ err: (err as Error).message, count: ilpLines.length }, "QuestDB batch ILP write notice");
      });
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
    const exact = this.candleCache.get(`${symbol}:${timeframe}`);
    const tfMs = timeframeToMs(timeframe);
    const list =
      exact ??
      (tfMs >= 60000
        ? this.candleCache.get(`${symbol}:1m`) ?? []
        : tfMs > 1000
          ? this.candleCache.get(`${symbol}:1s`) ?? []
          : []);
    if (list.length === 0) return [];

    let filtered = list;

    if (from !== undefined || to !== undefined) {
      filtered = list.filter(
        (c) => (from === undefined || c.openTime >= from) && (to === undefined || c.openTime <= to)
      );
    }

    if (exact || timeframe === "1m" || timeframe === "1s") {
      return filtered.slice(-limit);
    }

    return this.aggregateCandles(filtered, timeframe, tfMs).slice(-limit);
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
        finalized: list.every((c) => c.finalized) && bucketOpen + bucketMs <= Date.now(),
        synthetic: list.some((c) => c.synthetic),
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
      if (filtered.length < 50) {
        this.historySyncedAt.delete(key);
      }
      removed += beforeLen - filtered.length;
    }
    return removed;
  }
}
