import { EventEmitter } from "node:events";
import WebSocket from "ws";
import { request } from "undici";
import type {
  Candle,
  MarketSymbol,
  MarketTicker,
  Timeframe,
  ProviderStatusLevel,
} from "@gorengan/shared";
import { DEFAULT_SYMBOLS } from "@gorengan/shared";
import type { MarketProvider, ProviderStatus } from "../market-provider.js";
import { config } from "../../config/index.js";
import { publicFetch } from "../../utils/public-fetch.js";
import { logger } from "../../utils/logger.js";
import { toBinanceSymbol, toCanonicalSymbol } from "./binance-symbols.js";
import {
  normalizeBinanceTicker,
  normalizeBinanceTrade,
  type BinanceRawTicker,
  type BinanceRawTrade,
} from "./binance-normalizer.js";

export class BinanceProvider extends EventEmitter implements MarketProvider {
  public readonly id = "binance";

  private ws: WebSocket | null = null;
  private isConnected = false;
  private isConnecting = false;
  private reconnectAttempts = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private staleTimer: NodeJS.Timeout | null = null;
  private pingInterval: NodeJS.Timeout | null = null;

  private activeSymbols = new Set<string>();
  private lastEventAt = 0;
  private statusLevel: ProviderStatusLevel = "OFFLINE";

  constructor(initialSymbols?: string[]) {
    super();
    const source = initialSymbols || DEFAULT_SYMBOLS.map((x) => x.id);
    for (const s of source) {
      if (s.endsWith("-USDT") && !s.includes(":")) {
        this.activeSymbols.add(s);
      }
    }
  }

  public async connect(): Promise<void> {
    if (this.isConnected || this.isConnecting) return;

    this.isConnecting = true;
    this.setStatus("CONNECTING");

    // Fetch initial REST ticker snapshots so all symbols immediately have 24h data
    this.fetchTickerSnapshots().catch(() => {});

    const streams = this.buildStreamList();
    if (streams.length === 0) {
      logger.warn("No symbols to subscribe for Binance provider");
      this.isConnecting = false;
      return;
    }

    const wsUrl = config.BINANCE_WS_URL.endsWith("/stream")
      ? config.BINANCE_WS_URL.replace(/\/stream$/, "/ws")
      : `${config.BINANCE_WS_URL}/ws`;

    logger.info({ streamsCount: streams.length }, "Connecting to Binance WebSocket endpoint");

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.on("open", async () => {
        logger.info("Binance WebSocket stream connected successfully");
        this.isConnected = true;
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        this.lastEventAt = Date.now();
        this.setStatus("LIVE");
        this.startHeartbeat();

        // Subscribe via JSON-RPC in chunks of 50, paced to respect 5 msg/sec rate limit
        const chunkSize = 50;
        let reqId = 1;
        for (let i = 0; i < streams.length; i += chunkSize) {
          if (!this.ws || this.ws.readyState !== WebSocket.OPEN) break;
          const chunk = streams.slice(i, i + chunkSize);
          this.ws.send(
            JSON.stringify({
              method: "SUBSCRIBE",
              params: chunk,
              id: reqId++,
            })
          );
          if (i + chunkSize < streams.length) {
            await new Promise((r) => setTimeout(r, 220));
          }
        }
      });

      this.ws.on("message", (data: WebSocket.Data) => {
        this.handleMessage(data);
      });

      this.ws.on("ping", (data) => {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          this.ws.pong(data);
        }
      });

      this.ws.on("close", (code, reason) => {
        logger.warn(
          { code, reason: reason.toString() },
          "Binance WebSocket closed, scheduling reconnect"
        );
        this.handleDisconnect();
      });

      this.ws.on("error", (err) => {
        logger.error({ err }, "Binance WebSocket error encountered");
        this.emit("error", err);
      });
    } catch (err) {
      logger.error({ err }, "Failed to initiate Binance WebSocket connection");
      this.handleDisconnect();
    }

    this.startStaleWatchdog();
  }

  public async disconnect(): Promise<void> {
    this.clearTimers();
    if (this.ws) {
      this.ws.removeAllListeners();
      if (
        this.ws.readyState === WebSocket.OPEN ||
        this.ws.readyState === WebSocket.CONNECTING
      ) {
        this.ws.close();
      }
      this.ws = null;
    }
    this.isConnected = false;
    this.isConnecting = false;
    this.setStatus("OFFLINE");
  }

  public async getSymbols(): Promise<MarketSymbol[]> {
    return DEFAULT_SYMBOLS;
  }

  public async subscribe(symbols: string[]): Promise<void> {
    let added = false;
    for (const sym of symbols) {
      if (sym.endsWith("-USDT") && !sym.includes(":") && !this.activeSymbols.has(sym)) {
        this.activeSymbols.add(sym);
        added = true;
      }
    }

    if (added && this.isConnected) {
      // Binance combined stream connects to the configured list. Reconnect to include newly added symbols
      await this.disconnect();
      await this.connect();
    }
  }

  public async unsubscribe(symbols: string[]): Promise<void> {
    for (const sym of symbols) {
      this.activeSymbols.delete(sym);
    }
  }

  private async fetchRawKlinesPage(
    binanceSymbol: string,
    interval: string,
    endTime: number,
    limit: number,
    priority: "high" | "normal" | "low"
  ): Promise<(string | number)[][]> {
    const url = `${config.BINANCE_REST_URL}/api/v3/klines?symbol=${binanceSymbol}&interval=${interval}&endTime=${endTime}&limit=${limit}`;
    const response = await publicFetch(url, {
      priority,
      headers: { "User-Agent": "GorenganTerminal/1.0" },
    });

    if (response.status !== 200) {
      const bodyText = await response.text();
      throw new Error(`Binance REST klines HTTP ${response.status}: ${bodyText}`);
    }

    return (await response.json()) as (string | number)[][];
  }

  public async getHistoricalCandles(params: {
    symbol: string;
    timeframe: Timeframe;
    from: number;
    to: number;
    priority?: "high" | "normal" | "low";
  }): Promise<Candle[]> {
    if (!params.symbol.endsWith("-USDT") || params.symbol.includes(":")) {
      return [];
    }

    const binanceSymbol = toBinanceSymbol(params.symbol);
    const interval = this.mapTimeframeToBinance(params.timeframe);
    const priority = params.priority ?? "high";
    const isSubMinuteRollup = ["5s", "15s", "30s"].includes(params.timeframe);

    try {
      let raw: (string | number)[][];
      if (isSubMinuteRollup) {
        // Fetch up to 3 contiguous 1,000-second windows ending at params.to in parallel
        // so 5s gets ~600 bars, 15s gets ~200 bars, and 30s gets ~100 bars ending right at now.
        const pages = await Promise.allSettled([
          this.fetchRawKlinesPage(binanceSymbol, "1s", params.to - 2_000_000, 1000, "low"),
          this.fetchRawKlinesPage(binanceSymbol, "1s", params.to - 1_000_000, 1000, "normal"),
          this.fetchRawKlinesPage(binanceSymbol, "1s", params.to, 1000, priority),
        ]);
        raw = [];
        for (const p of pages) {
          if (p.status === "fulfilled" && Array.isArray(p.value)) {
            raw.push(...p.value);
          }
        }
      } else {
        raw = await this.fetchRawKlinesPage(binanceSymbol, interval, params.to, 1000, priority);
      }

      if (raw.length === 0) {
        return [];
      }

      const now = Date.now();
      const seenOpenTimes = new Set<number>();
      const candles: Candle[] = [];
      for (let i = 0; i < raw.length; i++) {
        const k = raw[i];
        const openTime = Number(k[0]);
        if (seenOpenTimes.has(openTime)) continue;
        seenOpenTimes.add(openTime);
        const closeTime = Number(k[6]);
        candles.push({
          symbol: params.symbol,
          timeframe: isSubMinuteRollup ? "1s" : params.timeframe,
          openTime,
          closeTime,
          open: parseFloat(String(k[1])),
          high: parseFloat(String(k[2])),
          low: parseFloat(String(k[3])),
          close: parseFloat(String(k[4])),
          volume: parseFloat(String(k[5])),
          trades: Number(k[8]),
          finalized: closeTime < now,
          provider: "binance",
        });
      }

      candles.sort((a, b) => a.openTime - b.openTime);

      if (isSubMinuteRollup) {
        const duration = Number.parseInt(params.timeframe, 10) * 1000;
        const groups = new Map<number, Candle[]>();
        for (let i = 0; i < candles.length; i++) {
          const candle = candles[i];
          const time = Math.floor(candle.openTime / duration) * duration;
          let group = groups.get(time);
          if (!group) {
            group = [];
            groups.set(time, group);
          }
          group.push(candle);
        }
        const aggregated: Candle[] = [];
        for (const [time, bars] of groups.entries()) {
          const first = bars[0];
          let high = first.high;
          let low = first.low;
          let volume = 0;
          let trades = 0;
          for (let j = 0; j < bars.length; j++) {
            const b = bars[j];
            if (b.high > high) high = b.high;
            if (b.low < low) low = b.low;
            volume += b.volume;
            trades += b.trades ?? 0;
          }
          aggregated.push({
            ...first,
            timeframe: params.timeframe,
            openTime: time,
            closeTime: time + duration - 1,
            close: bars[bars.length - 1].close,
            high,
            low,
            volume,
            trades,
            finalized: time + duration <= now,
          });
        }
        return aggregated;
      }
      return candles;
    } catch (err) {
      logger.error({ err, symbol: params.symbol }, "Failed to fetch Binance historical klines");
      return [];
    }
  }

  public getStatus(): ProviderStatus {
    return {
      provider: this.id,
      connected: this.isConnected,
      status: this.statusLevel,
      lastEventAt: this.lastEventAt,
      reconnectCount: this.reconnectAttempts,
      subscribedSymbols: Array.from(this.activeSymbols),
    };
  }

  private async fetchTickerSnapshots(): Promise<void> {
    try {
      const res = await request(`${config.BINANCE_REST_URL}/api/v3/ticker/24hr`);
      if (res.statusCode === 200) {
        const data = (await res.body.json()) as Array<{
          symbol: string;
          lastPrice: string;
          openPrice: string;
          highPrice: string;
          lowPrice: string;
          volume: string;
          quoteVolume: string;
          priceChange: string;
          priceChangePercent: string;
          closeTime: number;
        }>;

        let populatedCount = 0;
        for (const item of data) {
          const canonical = toCanonicalSymbol(item.symbol);
          if (this.activeSymbols.has(canonical)) {
            const ticker: MarketTicker = {
              symbol: canonical,
              timestamp: item.closeTime || Date.now(),
              price: parseFloat(item.lastPrice),
              open24h: parseFloat(item.openPrice),
              high24h: parseFloat(item.highPrice),
              low24h: parseFloat(item.lowPrice),
              volume24h: parseFloat(item.volume),
              quoteVolume24h: parseFloat(item.quoteVolume),
              change24h: parseFloat(item.priceChange),
              changePercent24h: parseFloat(item.priceChangePercent),
              provider: "binance",
            };
            this.emit("ticker", ticker);
            populatedCount++;
          }
        }
        logger.info({ populatedCount }, "Successfully populated Binance 24h ticker snapshots");
      }
    } catch (err) {
      logger.warn({ err }, "Could not fetch initial Binance 24h ticker snapshots");
    }
  }

  private handleMessage(data: WebSocket.Data): void {
    try {
      const text = typeof data === "string" ? data : data.toString("utf8");
      const json = JSON.parse(text);

      this.lastEventAt = Date.now();
      if (this.statusLevel !== "LIVE") {
        this.setStatus("LIVE");
      }

      // Binance combined stream payload: { stream: "btcusdt@trade", data: { ... } }
      const payload = json.data || json;
      const eventType = payload.e;

      if (eventType === "24hrTicker") {
        const ticker = normalizeBinanceTicker(payload as BinanceRawTicker);
        this.emit("ticker", ticker);
      } else if (eventType === "trade" || eventType === "aggTrade") {
        const trade = normalizeBinanceTrade(payload as BinanceRawTrade);
        this.emit("trade", trade);
      }
    } catch (err) {
      logger.warn({ err }, "Error parsing Binance WebSocket message");
    }
  }

  private handleDisconnect(): void {
    this.isConnected = false;
    this.isConnecting = false;
    this.setStatus("RECONNECTING");

    if (this.reconnectTimer) return;

    this.reconnectAttempts++;
    // Exponential backoff: 1s, 2s, 4s, 8s, 15s, max 30s + randomized jitter
    const delay = Math.min(
      Math.pow(2, this.reconnectAttempts - 1) * 1000 + Math.random() * 1000,
      30000
    );

    logger.info(
      { attempt: this.reconnectAttempts, delayMs: Math.round(delay) },
      "Scheduling Binance WebSocket reconnect"
    );

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  private setStatus(level: ProviderStatusLevel): void {
    this.statusLevel = level;
    this.emit("status", this.getStatus());
  }

  private buildStreamList(): string[] {
    const streams: string[] = [];
    for (const sym of this.activeSymbols) {
      const raw = toBinanceSymbol(sym).toLowerCase();
      // Subscribe to both 24h ticker and trade streams
      streams.push(`${raw}@ticker`);
      streams.push(`${raw}@trade`);
    }
    return streams;
  }

  private mapTimeframeToBinance(tf: Timeframe): string {
    switch (tf) {
      case "1s":
        return "1s";
      case "5s":
      case "15s":
      case "30s":
        return "1s";
      case "1m":
        return "1m";
      case "5m":
        return "5m";
      case "15m":
        return "15m";
      case "30m":
        return "30m";
      case "1h":
        return "1h";
      case "4h":
        return "4h";
      case "1d":
        return "1d";
      case "1w":
        return "1w";
      default:
        return "1m";
    }
  }

  private startHeartbeat(): void {
    if (this.pingInterval) clearInterval(this.pingInterval);
    this.pingInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.ping();
      }
    }, 30000);
  }

  private startStaleWatchdog(): void {
    if (this.staleTimer) clearInterval(this.staleTimer);
    this.staleTimer = setInterval(() => {
      if (this.isConnected) {
        const elapsed = Date.now() - this.lastEventAt;
        if (elapsed > config.STALE_THRESHOLD_MS && this.statusLevel === "LIVE") {
          logger.warn(
            { elapsedMs: elapsed, thresholdMs: config.STALE_THRESHOLD_MS },
            "Stale feed detected on Binance stream"
          );
          this.setStatus("STALE");
        }
      }
    }, 5000);
  }

  private clearTimers(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.staleTimer) {
      clearInterval(this.staleTimer);
      this.staleTimer = null;
    }
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }
}
