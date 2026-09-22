import { EventEmitter } from "node:events";
import type {
  MarketSymbol,
  NormalizedTrade,
  MarketTicker,
  Candle,
  Timeframe,
  ProviderStatusLevel,
} from "@gorengan/shared";

export interface ProviderStatus {
  provider: string;
  connected: boolean;
  status: ProviderStatusLevel;
  lastEventAt: number;
  reconnectCount: number;
  subscribedSymbols: string[];
}

export interface MarketProviderEvents {
  trade: (trade: NormalizedTrade) => void;
  ticker: (ticker: MarketTicker) => void;
  status: (status: ProviderStatus) => void;
  error: (err: Error) => void;
}

export interface MarketProvider extends EventEmitter {
  readonly id: string;

  connect(): Promise<void>;
  disconnect(): Promise<void>;

  getSymbols(): Promise<MarketSymbol[]>;
  subscribe(symbols: string[]): Promise<void>;
  unsubscribe(symbols: string[]): Promise<void>;

  getHistoricalCandles(params: {
    symbol: string;
    timeframe: Timeframe;
    from: number;
    to: number;
  }): Promise<Candle[]>;

  getStatus(): ProviderStatus;
}
