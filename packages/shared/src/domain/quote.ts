export type MarketSessionState = "open" | "closed" | "pre_open" | "halted" | "unknown";

export type CandlePriceBasis = "trade" | "mid" | "bid" | "ask";

export type VolumeKind = "real_trade_volume" | "provider_volume" | "tick_count" | "none";

export type SessionKind = "twenty_four_seven" | "fx_twenty_four_five" | "provider_controlled";

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
