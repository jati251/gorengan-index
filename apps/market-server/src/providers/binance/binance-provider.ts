import { EventEmitter } from "node:events";
import WebSocket from "ws";
import { request } from "undici";
import type {
  Candle,
  MarketSymbol,
  Timeframe,
  ProviderStatusLevel,
} from "@gorengan/shared";
import { DEFAULT_SYMBOLS } from "@gorengan/shared";
import type { MarketProvider, ProviderStatus } from "../market-provider.js";
import { config } from "../../config/index.js";
import { logger } from "../../utils/logger.js";
import { toBinanceSymbol } from "./binance-symbols.js";
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
    if (initialSymbols) {
      for (const s of initialSymbols) this.activeSymbols.add(s);
    } else {
      for (const s of DEFAULT_SYMBOLS.map((x) => x.id)) this.activeSymbols.add(s);
    }
  }

  public async connect(): Promise<void> {
    if (this.isConnected || this.isConnecting) return;

    this.isConnecting = true;
    this.setStatus("CONNECTING");

    const streams = this.buildStreamList();
    if (streams.length === 0) {
      logger.warn("No symbols to subscribe for Binance provider");
      this.isConnecting = false;
      return;
    }

    const wsUrl = `${config.BINANCE_WS_URL}/stream?streams=${streams.join("/")}`;
    logger.info({ streamsCount: streams.length }, "Connecting to Binance WebSocket stream");

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.on("open", () => {
        logger.info("Binance WebSocket stream connected successfully");
        this.isConnected = true;
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        this.lastEventAt = Date.now();
        this.setStatus("LIVE");
        this.startHeartbeat();
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
      if (!this.activeSymbols.has(sym)) {
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

  public async getHistoricalCandles(params: {
    symbol: string;
    timeframe: Timeframe;
    from: number;
    to: number;
  }): Promise<Candle[]> {
    const binanceSymbol = toBinanceSymbol(params.symbol);
    const interval = this.mapTimeframeToBinance(params.timeframe);

    // Endpoint: /api/v3/klines?symbol=...&interval=...&startTime=...&endTime=...&limit=1000
    const url = `${config.BINANCE_REST_URL}/api/v3/klines?symbol=${binanceSymbol}&interval=${interval}&startTime=${params.from}&endTime=${params.to}&limit=1000`;

    try {
      const response = await request(url, {
        headers: { "User-Agent": "GorenganTerminal/1.0" },
      });

      if (response.statusCode !== 200) {
        const bodyText = await response.body.text();
        throw new Error(
          `Binance REST klines HTTP ${response.statusCode}: ${bodyText}`
        );
      }

      const raw = (await response.body.json()) as (string | number)[][];
      const candles: Candle[] = raw.map((k) => ({
        symbol: params.symbol,
        timeframe: params.timeframe,
        openTime: Number(k[0]),
        closeTime: Number(k[6]),
        open: parseFloat(String(k[1])),
        high: parseFloat(String(k[2])),
        low: parseFloat(String(k[3])),
        close: parseFloat(String(k[4])),
        volume: parseFloat(String(k[5])),
        trades: Number(k[8]),
        finalized: true,
        provider: "binance",
      }));

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
