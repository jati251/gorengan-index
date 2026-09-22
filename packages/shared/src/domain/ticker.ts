import type { MarketSessionState } from "./quote.js";
import type { AssetClass } from "./symbol.js";

export interface MarketTicker {
  symbol: string; // Canonical symbol, e.g. "BTC-USDT", "EUR-USD"
  timestamp: number; // Unix ms
  price: number;
  open24h?: number;
  high24h?: number;
  low24h?: number;
  volume24h?: number;
  quoteVolume24h?: number;
  change24h?: number;
  changePercent24h?: number;
  provider: string; // e.g. "binance", "interbank"
  assetClass?: AssetClass;
  bid?: number;
  ask?: number;
  mid?: number;
  spread?: number;
  spreadPips?: number;
  spreadBps?: number;
  sessionState?: MarketSessionState;
}
