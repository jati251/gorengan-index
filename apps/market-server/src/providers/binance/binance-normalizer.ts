import type { MarketTicker, NormalizedTrade } from "@gorengan/shared";
import { toCanonicalSymbol } from "./binance-symbols.js";

export interface BinanceRawTicker {
  e: string; // "24hrTicker"
  E: number; // Event time
  s: string; // Symbol "BTCUSDT"
  c: string; // Last price
  o: string; // Open price 24h
  h: string; // High price 24h
  l: string; // Low price 24h
  v: string; // Base volume
  q: string; // Quote volume
  p: string; // Price change
  P: string; // Price change percent
}

export interface BinanceRawTrade {
  e: string; // "trade" or "aggTrade"
  E: number; // Event time
  s: string; // Symbol
  p: string; // Price
  q: string; // Quantity
  T: number; // Trade time
  m: boolean; // Buyer maker (true -> seller aggressive/sell, false -> buyer aggressive/buy)
}

export function normalizeBinanceTicker(raw: BinanceRawTicker): MarketTicker {
  return {
    symbol: toCanonicalSymbol(raw.s),
    timestamp: raw.E,
    price: parseFloat(raw.c),
    open24h: parseFloat(raw.o),
    high24h: parseFloat(raw.h),
    low24h: parseFloat(raw.l),
    volume24h: parseFloat(raw.v),
    quoteVolume24h: parseFloat(raw.q),
    change24h: parseFloat(raw.p),
    changePercent24h: parseFloat(raw.P),
    provider: "binance",
  };
}

export function normalizeBinanceTrade(raw: BinanceRawTrade): NormalizedTrade {
  return {
    provider: "binance",
    symbol: toCanonicalSymbol(raw.s),
    timestamp: raw.T || raw.E,
    price: parseFloat(raw.p),
    quantity: parseFloat(raw.q),
    side: raw.m ? "sell" : "buy",
  };
}
