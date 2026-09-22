export type MarketSessionState =
  | "open"
  | "regular"
  | "pre_market"
  | "break"
  | "after_hours"
  | "overnight"
  | "closed"
  | "holiday"
  | "halted"
  | "pre_open"
  | "unknown";

export type CandlePriceBasis = "trade" | "mid" | "bid" | "ask";

export type VolumeKind = "real_trade_volume" | "provider_volume" | "tick_count" | "none";

export type SessionKind = "twenty_four_seven" | "fx_twenty_four_five" | "provider_controlled";

export type MarketDataQuality =
  | "realtime_venue"
  | "realtime_consolidated"
  | "near_realtime"
  | "delayed"
  | "end_of_day"
  | "last_known";

export type VolumeScope = "venue_only" | "consolidated" | "provider_reported" | "unknown";

export type CandleQuality = "trade_derived" | "provider_bar" | "quote_derived" | "snapshot_derived";

export interface DataProvenance {
  provider: string;
  venue?: string;
  quality: MarketDataQuality;
  delaySeconds?: number | null;
  isConsolidated: boolean;
}

export interface FxQuoteTick {
  instrument: string; // Canonical identifier e.g. "EUR-USD"
  provider: string; // e.g. "mt5", "yahoo", "dukascopy"
  providerSymbol: string; // e.g. "EURUSD=X"
  bid: number;
  ask: number;
  mid: number;
  spread: number;
  spreadBps: number;
  providerTs: number; // Unix ms
  ingestTs: number; // Unix ms
  sequence?: number;
  tradeable?: boolean;
  bidSize?: number;
  askSize?: number;
}

