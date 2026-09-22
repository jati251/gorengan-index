import type { Candle, Timeframe } from "../domain/candle.js";
import type { MarketSymbol } from "../domain/symbol.js";
import type { MarketTicker } from "../domain/ticker.js";
import type { ProviderStatusLevel } from "./websocket.js";

export interface HealthResponse {
  status: "ok" | "degraded" | "error";
  version: string;
  uptimeSeconds: number;
  database: "ok" | "error";
  providers: Record<
    string,
    {
      connected: boolean;
      status: ProviderStatusLevel;
      lastEventAgoMs: number;
      subscriptions: number;
    }
  >;
  timestamp: number;
}

export interface SymbolsResponse {
  symbols: MarketSymbol[];
}

export interface MarketsResponse {
  markets: MarketTicker[];
  timestamp: number;
}

export interface MarketDetailResponse {
  symbol: string;
  ticker: MarketTicker | null;
  candle1m: Candle | null;
}

export interface CandlesQuery {
  timeframe?: Timeframe;
  from?: number; // Unix ms
  to?: number; // Unix ms
  limit?: number; // Max bars (default 500, max 1500)
}

export interface CandlesResponse {
  symbol: string;
  timeframe: Timeframe;
  candles: Candle[];
}
