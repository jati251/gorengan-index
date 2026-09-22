import type { FxQuoteTick, MarketSessionState, CandlePriceBasis, AssetClass } from "@gorengan/shared";

export type { FxQuoteTick, MarketSessionState, CandlePriceBasis, AssetClass };

export interface FxPairMetadata {
  id: string; // e.g. "EUR-USD"
  base: string; // "EUR"
  quote: string; // "USD"
  name: string; // "Euro / US Dollar"
  pipSize: number; // 0.0001
  displayDecimals: number; // 5
  venueLabel: string; // "Interbank"
}
