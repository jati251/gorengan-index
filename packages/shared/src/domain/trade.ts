export interface NormalizedTrade {
  provider: string; // "binance"
  symbol: string; // "BTC-USDT"
  timestamp: number; // Unix ms
  price: number;
  quantity: number;
  side?: "buy" | "sell";
}
