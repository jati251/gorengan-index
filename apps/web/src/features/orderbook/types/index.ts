export type OrderBookViewMode = "all" | "bids" | "asks";

export interface OrderBookLevel {
  price: number;
  size: number;
  total: number;
  depthPercent: number; // 0 to 100
}

export interface OrderBookData {
  symbol: string;
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  spread: number;
  spreadPercent: number;
  lastPrice: number;
  timestamp: number;
  isLoading: boolean;
  source: "binance_live" | "synthetic" | "connecting";
  displayDecimals: number;
}
