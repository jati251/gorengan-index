import { EventEmitter } from "node:events";
import type {
  Candle,
  MarketSymbol,
  Timeframe,
  MarketTicker,
} from "@gorengan/shared";
import { DEFAULT_SYMBOLS, timeframeToMs } from "@gorengan/shared";
import type { MarketProvider, ProviderStatus } from "../market-provider.js";
import { publicFetch } from "../../utils/public-fetch.js";
import { logger } from "../../utils/logger.js";

interface YahooChartResponse {
  chart?: {
    result?: Array<{
      meta?: {
        symbol?: string;
        regularMarketPrice?: number;
        regularMarketTime?: number;
        previousClose?: number;
        chartPreviousClose?: number;
        regularMarketDayHigh?: number;
        regularMarketDayLow?: number;
        regularMarketVolume?: number;
      };
      timestamp?: number[];
      indicators?: {
        quote?: Array<{
          open?: (number | null)[];
          high?: (number | null)[];
          low?: (number | null)[];
          close?: (number | null)[];
          volume?: (number | null)[];
        }>;
      };
    }>;
    error?: {
      code?: string;
      description?: string;
    };
  };
}

export class YahooMarketProvider extends EventEmitter implements MarketProvider {
  public readonly id = "yahoo";

  private isConnected = false;
  private pollTimer: NodeJS.Timeout | null = null;
  private symbols: MarketSymbol[] = [];
  private symbolMap = new Map<string, MarketSymbol>();
  private lastEventAt = 0;
  private polling = false;
  private cooldownUntil = 0;

  constructor(symbols?: MarketSymbol[]) {
    super();
    const source = symbols || DEFAULT_SYMBOLS;
    // Keep only non-crypto symbols (forex, us_stocks, idx_stocks)
    this.symbols = source.filter(
      (s) => s.assetClass !== "crypto" && s.assetClass !== "metal" && s.provider !== "binance"
    );
    for (const s of this.symbols) {
      this.symbolMap.set(s.id, s);
    }
  }

  public async connect(): Promise<void> {
    if (this.isConnected) return;
    this.isConnected = true;
    this.lastEventAt = Date.now();
    logger.info({ nonCryptoSymbolsCount: this.symbols.length }, "Yahoo Market Provider connected");

    this.emitStatus();

    // Start background polling to keep quotes fresh
    this.startPolling();
  }

  public async disconnect(): Promise<void> {
    this.isConnected = false;
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    this.emitStatus();
  }

  public async getSymbols(): Promise<MarketSymbol[]> {
    return this.symbols;
  }

  public async subscribe(symbols: string[]): Promise<void> {
    for (const sym of symbols) {
      const match = DEFAULT_SYMBOLS.find((s) => s.id === sym);
      if (match && !this.symbolMap.has(sym)) {
        this.symbols.push(match);
        this.symbolMap.set(sym, match);
      }
    }
  }

  public async unsubscribe(symbols: string[]): Promise<void> {
    for (const sym of symbols) {
      this.symbolMap.delete(sym);
    }
    this.symbols = this.symbols.filter((s) => this.symbolMap.has(s.id));
  }

  public async getHistoricalCandles(params: {
    symbol: string;
    timeframe: Timeframe;
    from: number;
    to: number;
  }): Promise<Candle[]> {
    if (timeframeToMs(params.timeframe) < 60000 || Date.now() < this.cooldownUntil) return [];
    const meta = this.symbolMap.get(params.symbol);
    const yahooSymbol = meta?.providerSymbol || this.inferYahooSymbol(params.symbol);
    const interval = this.mapTimeframeToYahoo(params.timeframe);
    const range = this.mapTimeframeToRange(params.timeframe);

    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
      yahooSymbol
    )}?range=${range}&interval=${interval}`;

    try {
      const res = await publicFetch(url, {
        signal: AbortSignal.timeout(8000),
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
      });

      if ([429, 403, 503].includes(res.status)) this.cooldownUntil = Date.now() + Math.max(60000, Number(res.headers.get("retry-after")) * 1000 || 60000);
      if (!res.ok) {
        throw new Error(`Yahoo Finance chart HTTP ${res.status}`);
      }

      const data = (await res.json()) as YahooChartResponse;
      const result = data.chart?.result?.[0];

      if (!result || !result.timestamp || result.timestamp.length === 0) {
        throw new Error("No timestamp bars in Yahoo chart response");
      }

      const timestamps = result.timestamp;
      const quotes = result.indicators?.quote?.[0];
      if (!quotes) throw new Error("No quotes in Yahoo response");

      const candles: Candle[] = [];
      const stepMs = interval === "60m" ? 3600000 : timeframeToMs(params.timeframe);

      for (let i = 0; i < timestamps.length; i++) {
        const t = timestamps[i] * 1000;
        const o = quotes.open?.[i];
        const h = quotes.high?.[i];
        const l = quotes.low?.[i];
        const c = quotes.close?.[i];
        const v = quotes.volume?.[i] ?? 0;

        // Skip incomplete or null bars
        if (o == null || h == null || l == null || c == null || ![o,h,l,c,v].every(Number.isFinite) || l <= 0 || l > Math.min(o,c) || h < Math.max(o,c) || v < 0) continue;
        if (t < params.from || t > params.to) continue;

        candles.push({
          symbol: params.symbol,
          timeframe: params.timeframe === "4h" ? "1h" : params.timeframe,
          openTime: t,
          closeTime: t + stepMs - 1,
          open: o,
          high: h,
          low: l,
          close: c,
          volume: v,
          finalized: t + stepMs <= Date.now(),
          provider: "yahoo",
        });
      }

      if (candles.length > 0) {
        // Also emit a ticker update if meta is present
        if (result.meta?.regularMarketPrice) {
          const ticker = this.parseTickerFromMeta(params.symbol, result.meta);
          this.emit("ticker", ticker);
        }
        return params.timeframe === "4h" ? this.aggregateFourHours(candles) : candles;
      }

      throw new Error("Filtered candle bars resulted in 0 valid candles");
    } catch (err) {
      logger.warn(
        { err: (err as Error).message, symbol: params.symbol, yahooSymbol },
        "Yahoo chart fetch failed, returning empty candles"
      );
      return [];
    }
  }

  public getStatus(): ProviderStatus {
    return {
      provider: this.id,
      connected: this.isConnected,
      status: this.isConnected ? "LIVE" : "OFFLINE",
      lastEventAt: this.lastEventAt,
      reconnectCount: 0,
      subscribedSymbols: this.symbols.map((s) => s.id),
    };
  }

  private startPolling(): void {
    if (this.pollTimer) clearInterval(this.pollTimer);

    // Initial refresh immediately
    this.pollBatchQuotes();

    // Poll every 30 seconds
    this.pollTimer = setInterval(() => {
      if (this.isConnected) {
        this.pollBatchQuotes();
      }
    }, 30000);
  }

  private async pollBatchQuotes(): Promise<void> {
    if (this.polling || Date.now() < this.cooldownUntil) return;
    this.polling = true;
    try {
    const symbolsToPoll = [...this.symbols];
    const chunkSize = 2;

    for (let i = 0; i < symbolsToPoll.length; i += chunkSize) {
      if (!this.isConnected || Date.now() < this.cooldownUntil) break;
      const chunk = symbolsToPoll.slice(i, i + chunkSize);
      await Promise.allSettled(chunk.map((sym) => this.pollSingleSymbol(sym)));
      if (i + chunkSize < symbolsToPoll.length) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
    } finally { this.polling = false; }
  }

  private async pollSingleSymbol(marketSym: MarketSymbol): Promise<void> {
    try {
      const yahooSym = marketSym.providerSymbol || this.inferYahooSymbol(marketSym.id);
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
        yahooSym
      )}?range=1d&interval=5m`;

      const res = await publicFetch(url, {
        signal: AbortSignal.timeout(8000),
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
      });

      if ([429, 403, 503].includes(res.status)) {
        this.cooldownUntil = Date.now() + Math.max(60000, Number(res.headers.get("retry-after")) * 1000 || 60000);
      }
      if (!res.ok) return;

      const data = (await res.json()) as YahooChartResponse;
      const result = data.chart?.result?.[0];
      const meta = result?.meta;

      if (!meta || !meta.regularMarketPrice) return;

      this.lastEventAt = Date.now();
      const ticker = this.parseTickerFromMeta(marketSym.id, meta);
      this.emit("ticker", ticker);

    } catch {
      // Quietly ignore polling failures for individual symbols
    }
  }

  private parseTickerFromMeta(
    canonicalSymbol: string,
    meta: NonNullable<NonNullable<YahooChartResponse["chart"]>["result"]>[0]["meta"]
  ): MarketTicker {
    const lastPrice = meta?.regularMarketPrice ?? 0;
    const prevClose = meta?.previousClose || meta?.chartPreviousClose || lastPrice;
    const priceChange = lastPrice - prevClose;
    const priceChangePercent = prevClose > 0 ? (priceChange / prevClose) * 100 : 0;
    const high = meta?.regularMarketDayHigh;
    const low = meta?.regularMarketDayLow;
    const volume = meta?.regularMarketVolume;

    const isId = canonicalSymbol.startsWith("ID:");
    const isFx = !isId && !canonicalSymbol.startsWith("US:") && !canonicalSymbol.endsWith("USDT");
    const decimals = isId ? 0 : isFx ? 4 : lastPrice < 1 ? 6 : 2;
    const round = (val: number) => (decimals === 0 ? Math.round(val) : parseFloat(val.toFixed(decimals)));

    return {
      symbol: canonicalSymbol,
      price: round(lastPrice),
      open24h: round(prevClose),
      high24h: high == null ? undefined : round(high),
      low24h: low == null ? undefined : round(low),
      volume24h: volume == null ? undefined : Math.round(volume),
      change24h: round(priceChange),
      changePercent24h: parseFloat(priceChangePercent.toFixed(2)),
      timestamp: (meta?.regularMarketTime ?? 0) * 1000,
      provider: "yahoo",
      dataQuality: "delayed",
    };
  }

  private aggregateFourHours(candles: Candle[]): Candle[] {
    const buckets = new Map<number, Candle[]>();
    for (const candle of candles) {
      const time = Math.floor(candle.openTime / 14400000) * 14400000;
      buckets.set(time, [...(buckets.get(time) ?? []), candle]);
    }
    return [...buckets].map(([time, bars]) => ({ ...bars[0], timeframe: "4h", openTime: time, closeTime: time + 14400000 - 1,
      high: Math.max(...bars.map((b) => b.high)), low: Math.min(...bars.map((b) => b.low)), close: bars[bars.length - 1].close,
      volume: bars.reduce((sum, b) => sum + b.volume, 0), finalized: bars.every((b) => b.finalized) && time + 14400000 <= Date.now() }));
  }

  private inferYahooSymbol(canonical: string): string {
    if (canonical.startsWith("US:")) return canonical.slice(3);
    if (canonical.startsWith("ID:")) return `${canonical.slice(3)}.JK`;
    if (canonical.includes("-")) return `${canonical.replace("-", "")}=X`;
    return canonical;
  }

  private mapTimeframeToYahoo(tf: Timeframe): string {
    switch (tf) {
      case "1s":
      case "5s":
      case "15s":
      case "30s":
      case "1m":
        return "1m";
      case "5m":
        return "5m";
      case "15m":
        return "15m";
      case "30m":
        return "30m";
      case "1h":
      case "4h":
        return "60m";
      case "1d":
        return "1d";
      case "1w":
        return "1wk";
      default:
        return "1m";
    }
  }

  private mapTimeframeToRange(tf: Timeframe): string {
    switch (tf) {
      case "1s":
      case "5s":
      case "15s":
      case "30s":
      case "1m":
      case "5m":
      case "15m":
      case "30m":
        return "5d";
      case "1h":
      case "4h":
        return "1mo";
      case "1d":
        return "1y";
      case "1w":
        return "5y";
      default:
        return "5d";
    }
  }

  private emitStatus(): void {
    this.emit("status", this.getStatus());
  }
}
