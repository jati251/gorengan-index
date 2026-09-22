import { DatabaseSync } from "node:sqlite";
import type { Candle, Timeframe, MarketSymbol } from "@gorengan/shared";
import { timeframeToMs } from "@gorengan/shared";
import { getDatabase } from "./database.js";
import { logger } from "../utils/logger.js";

interface CandleRow {
  symbol: string;
  timeframe: string;
  open_time: number | bigint;
  close_time: number | bigint;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  trades: number | bigint | null;
  provider: string;
}

interface SymbolRow {
  id: string;
  provider: string;
  provider_symbol: string;
  base_asset: string;
  quote_asset: string;
  asset_class: string;
  name: string;
  enabled: number;
  is_tokenized_metal: number;
}

export class CandleRepository {
  private db: DatabaseSync;

  constructor(db?: DatabaseSync) {
    this.db = db || getDatabase();
  }

  public getSymbols(): MarketSymbol[] {
    const rows = this.db
      .prepare("SELECT * FROM symbols WHERE enabled = 1")
      .all() as unknown as SymbolRow[];

    return rows.map((r) => ({
      id: r.id,
      provider: r.provider,
      providerSymbol: r.provider_symbol,
      base: r.base_asset,
      quote: r.quote_asset,
      assetClass: r.asset_class as MarketSymbol["assetClass"],
      name: r.name,
      enabled: r.enabled === 1,
      isTokenizedMetal: r.is_tokenized_metal === 1,
    }));
  }

  public saveCandle(candle: Candle): void {
    const stmt = this.db.prepare(`
      INSERT INTO candles (
        symbol, timeframe, open_time, close_time,
        open, high, low, close, volume, trades, provider
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(symbol, timeframe, open_time) DO UPDATE SET
        close_time = excluded.close_time,
        open = excluded.open,
        high = excluded.high,
        low = excluded.low,
        close = excluded.close,
        volume = excluded.volume,
        trades = excluded.trades,
        provider = excluded.provider
    `);

    stmt.run(
      candle.symbol,
      candle.timeframe,
      candle.openTime,
      candle.closeTime,
      candle.open,
      candle.high,
      candle.low,
      candle.close,
      candle.volume,
      candle.trades ?? 0,
      candle.provider || "binance"
    );
  }

  public saveCandles(candles: Candle[]): void {
    if (candles.length === 0) return;

    const stmt = this.db.prepare(`
      INSERT INTO candles (
        symbol, timeframe, open_time, close_time,
        open, high, low, close, volume, trades, provider
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(symbol, timeframe, open_time) DO UPDATE SET
        close_time = excluded.close_time,
        open = excluded.open,
        high = excluded.high,
        low = excluded.low,
        close = excluded.close,
        volume = excluded.volume,
        trades = excluded.trades,
        provider = excluded.provider
    `);

    this.db.exec("BEGIN TRANSACTION;");
    try {
      for (const candle of candles) {
        stmt.run(
          candle.symbol,
          candle.timeframe,
          candle.openTime,
          candle.closeTime,
          candle.open,
          candle.high,
          candle.low,
          candle.close,
          candle.volume,
          candle.trades ?? 0,
          candle.provider || "binance"
        );
      }
      this.db.exec("COMMIT;");
    } catch (err) {
      this.db.exec("ROLLBACK;");
      logger.error({ err }, "Failed to batch save candles");
      throw err;
    }
  }

  public getLatestCandle(symbol: string, timeframe: Timeframe = "1m"): Candle | null {
    const row = this.db
      .prepare(`
        SELECT * FROM candles
        WHERE symbol = ? AND timeframe = ?
        ORDER BY open_time DESC
        LIMIT 1
      `)
      .get(symbol, timeframe) as unknown as CandleRow | undefined;

    if (!row) return null;
    return this.rowToCandle(row);
  }

  public getCandles(
    symbol: string,
    timeframe: Timeframe = "1m",
    from?: number,
    to?: number,
    limit: number = 500
  ): Candle[] {
    const safeLimit = Math.min(Math.max(limit, 1), 1500);

    // If 1m, fetch directly from candles table
    if (timeframe === "1m") {
      let query = `
        SELECT * FROM candles
        WHERE symbol = ? AND timeframe = '1m'
      `;
      const params: (string | number)[] = [symbol];

      if (from !== undefined) {
        query += " AND open_time >= ?";
        params.push(from);
      }
      if (to !== undefined) {
        query += " AND open_time <= ?";
        params.push(to);
      }

      query += ` ORDER BY open_time DESC LIMIT ${safeLimit}`;

      const rows = this.db.prepare(query).all(...params) as unknown as CandleRow[];
      // Reverse to chronological order (ascending)
      return rows.map((r) => this.rowToCandle(r)).reverse();
    }

    // For higher timeframes (5m, 15m, 1h, 4h, 1d, 1w), aggregate from 1m bars
    const bucketMs = timeframeToMs(timeframe);
    // Fetch 1m candles covering the required range
    let query = `
      SELECT * FROM candles
      WHERE symbol = ? AND timeframe = '1m'
    `;
    const params: (string | number)[] = [symbol];

    if (from !== undefined) {
      query += " AND open_time >= ?";
      params.push(from);
    }
    if (to !== undefined) {
      query += " AND open_time <= ?";
      params.push(to);
    }

    // Pull sufficient 1m records to build the aggregated bars
    const fetchLimit = safeLimit * Math.ceil(bucketMs / 60000);
    query += ` ORDER BY open_time DESC LIMIT ${Math.min(fetchLimit, 20000)}`;

    const rows = this.db.prepare(query).all(...params) as unknown as CandleRow[];
    const rawCandles = rows.map((r) => this.rowToCandle(r)).reverse();

    return this.aggregateCandles(rawCandles, timeframe, bucketMs).slice(-safeLimit);
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
    const result = this.db
      .prepare(`
        DELETE FROM candles
        WHERE timeframe = '1m' AND open_time < ?
      `)
      .run(cutoffMs);

    return Number(result.changes);
  }

  private rowToCandle(row: CandleRow): Candle {
    return {
      symbol: row.symbol,
      timeframe: row.timeframe as Timeframe,
      openTime: Number(row.open_time),
      closeTime: Number(row.close_time),
      open: row.open,
      high: row.high,
      low: row.low,
      close: row.close,
      volume: row.volume,
      trades: row.trades != null ? Number(row.trades) : undefined,
      finalized: true,
      provider: row.provider,
    };
  }
}
