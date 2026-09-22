import type { MarketSessionState, DataProvenance } from "./quote.js";
import type { AssetClass } from "./symbol.js";

export interface EquityInstrument {
  id: string; // e.g. "US:AAPL", "ID:BBCA"
  symbol: string; // e.g. "AAPL", "BBCA"
  displaySymbol: string; // e.g. "AAPL", "BBCA"
  assetClass: AssetClass;
  exchange: string; // e.g. "NASDAQ", "NYSE", "IDX"
  country: "US" | "ID";
  currency: "USD" | "IDR";
  timezone: string; // e.g. "America/New_York", "Asia/Jakarta"
  tickSize: number;
  active: boolean;
  isin?: string;
  figi?: string;
}

export interface EquityTradeTick {
  instrument: string;
  provider: string;
  venue?: string;
  price: number;
  quantity: number;
  exchangeTsNs: number;
  receivedTsNs: number;
  conditions?: string[];
  provenance: DataProvenance;
}

export interface EquityQuoteTick {
  instrument: string;
  provider: string;
  venue?: string;
  bid?: number;
  bidSize?: number;
  ask?: number;
  askSize?: number;
  last?: number;
  timestampNs: number;
  provenance: DataProvenance;
}

export interface EquitySnapshot {
  instrument: string;
  symbol: string;
  market: "US" | "ID";
  currency: "USD" | "IDR";
  last?: number;
  open?: number;
  high?: number;
  low?: number;
  previousClose?: number;
  volume?: number;
  bid?: number;
  ask?: number;
  change?: number;
  changePercent?: number;
  marketState: MarketSessionState;
  sessionSegment?: string; // e.g. "SESSION_1", "SESSION_2", "REGULAR"
  timestampNs: number;
  provenance: DataProvenance;
  stale?: boolean;
}

export type CorporateActionType =
  | "split"
  | "reverse_split"
  | "dividend"
  | "symbol_change"
  | "delisting";

export interface CorporateAction {
  effectiveTs: number;
  instrument: string;
  actionType: CorporateActionType;
  ratioFrom?: number;
  ratioTo?: number;
  cashAmount?: number;
  currency?: string;
  source: string;
}
