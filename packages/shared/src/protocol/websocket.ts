import type { Candle, Timeframe } from "../domain/candle.js";
import type { MarketTicker } from "../domain/ticker.js";

export type ClientOp = "subscribe" | "unsubscribe" | "ping";

export interface SubscribeMessage {
  op: "subscribe";
  channels: string[]; // e.g. ["ticker:BTC-USDT", "candle:BTC-USDT:1m"]
}

export interface UnsubscribeMessage {
  op: "unsubscribe";
  channels: string[];
}

export interface PingMessage {
  op: "ping";
}

export type WebSocketClientMessage =
  | SubscribeMessage
  | UnsubscribeMessage
  | PingMessage;

export type ProviderStatusLevel = "CONNECTING" | "LIVE" | "STALE" | "RECONNECTING" | "OFFLINE";

export interface TickerEventMessage {
  type: "ticker";
  symbol: string;
  ts: number;
  ticker: MarketTicker;
}

export interface CandleEventMessage {
  type: "candle";
  symbol: string;
  timeframe: Timeframe;
  candle: Candle;
}

export interface StatusEventMessage {
  type: "status";
  provider: string;
  connected: boolean;
  lastEventAt: number;
  status: ProviderStatusLevel;
  activeSymbols: string[];
}

export interface SnapshotMessage {
  type: "snapshot";
  tickers: Record<string, MarketTicker>;
  candles: Record<string, Candle>;
  statuses: Record<string, StatusEventMessage>;
}

export interface PongMessage {
  type: "pong";
  ts: number;
}

export interface ErrorMessage {
  type: "error";
  message: string;
}

export type WebSocketServerMessage =
  | TickerEventMessage
  | CandleEventMessage
  | StatusEventMessage
  | SnapshotMessage
  | PongMessage
  | ErrorMessage;

export function formatTickerChannel(symbol: string): string {
  return `ticker:${symbol}`;
}

export function formatCandleChannel(symbol: string, timeframe: Timeframe = "1m"): string {
  return `candle:${symbol}:${timeframe}`;
}

export function formatStatusChannel(provider: string = "binance"): string {
  return `status:${provider}`;
}

export interface ParsedChannel {
  type: "ticker" | "candle" | "status";
  symbol?: string;
  timeframe?: Timeframe;
  provider?: string;
}

export function parseChannel(channel: string): ParsedChannel | null {
  const parts = channel.split(":");
  if (parts.length === 0) return null;

  if (parts[0] === "ticker" && parts[1]) {
    return { type: "ticker", symbol: parts[1] };
  }

  if (parts[0] === "candle" && parts[1]) {
    return {
      type: "candle",
      symbol: parts[1],
      timeframe: (parts[2] as Timeframe) || "1m",
    };
  }

  if (parts[0] === "status") {
    return {
      type: "status",
      provider: parts[1] || "binance",
    };
  }

  return null;
}
