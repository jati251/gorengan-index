import type { DataProvenance, MarketDataQuality, MarketSessionState } from "./quote.js";
import type { AssetClass } from "./symbol.js";

export interface MarketTicker {
  symbol: string; // Canonical symbol, e.g. "BTC-USDT", "EUR-USD", "US:AAPL", "ID:BBCA"
  timestamp: number; // Unix ms
  price: number;
  open24h?: number;
  high24h?: number;
  low24h?: number;
  volume24h?: number;
  quoteVolume24h?: number;
  change24h?: number;
  changePercent24h?: number;
  provider: string; // e.g. "binance", "interbank", "alpaca_iex", "idx_delayed"
  assetClass?: AssetClass;
  bid?: number;
  ask?: number;
  mid?: number;
  spread?: number;
  spreadPips?: number;
  spreadBps?: number;
  sessionState?: MarketSessionState;
  sessionSegment?: string; // "SESSION_1" | "SESSION_2" | "REGULAR" | "BREAK"
  dataQuality?: MarketDataQuality;
  provenance?: DataProvenance;
  market?: "US" | "ID" | "CRYPTO" | "FX";
  currency?: string;
  previousClose?: number;
}
