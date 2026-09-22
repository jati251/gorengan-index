import type {
  EquityInstrument,
  MarketSessionState,
  MarketDataQuality,
  DataProvenance,
  AssetClass,
} from "@gorengan/shared";

export type {
  EquityInstrument,
  MarketSessionState,
  MarketDataQuality,
  DataProvenance,
  AssetClass,
};

export interface EquityMetadata {
  id: string; // e.g. "US:AAPL" or "ID:BBCA"
  symbol: string; // "AAPL" or "BBCA"
  name: string; // "Apple Inc."
  exchange: string; // "NASDAQ", "NYSE", "IDX"
  country: "US" | "ID";
  currency: "USD" | "IDR";
  flag: string;
  defaultDataQuality: MarketDataQuality;
}
