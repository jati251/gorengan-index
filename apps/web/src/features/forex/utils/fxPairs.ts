import type { FxPairMetadata } from "../types";

export const FX_PAIRS: Record<string, FxPairMetadata> = {
  "EUR-USD": {
    id: "EUR-USD",
    base: "EUR",
    quote: "USD",
    name: "Euro / US Dollar",
    pipSize: 0.0001,
    displayDecimals: 5,
    venueLabel: "Interbank",
  },
  "GBP-USD": {
    id: "GBP-USD",
    base: "GBP",
    quote: "USD",
    name: "British Pound / US Dollar",
    pipSize: 0.0001,
    displayDecimals: 5,
    venueLabel: "Interbank",
  },
  "USD-JPY": {
    id: "USD-JPY",
    base: "USD",
    quote: "JPY",
    name: "US Dollar / Japanese Yen",
    pipSize: 0.01,
    displayDecimals: 3,
    venueLabel: "Interbank",
  },
  "AUD-USD": {
    id: "AUD-USD",
    base: "AUD",
    quote: "USD",
    name: "Australian Dollar / US Dollar",
    pipSize: 0.0001,
    displayDecimals: 5,
    venueLabel: "Interbank",
  },
  "USD-CAD": {
    id: "USD-CAD",
    base: "USD",
    quote: "CAD",
    name: "US Dollar / Canadian Dollar",
    pipSize: 0.0001,
    displayDecimals: 5,
    venueLabel: "Interbank",
  },
  "USD-CHF": {
    id: "USD-CHF",
    base: "USD",
    quote: "CHF",
    name: "US Dollar / Swiss Franc",
    pipSize: 0.0001,
    displayDecimals: 5,
    venueLabel: "Interbank",
  },
  "NZD-USD": {
    id: "NZD-USD",
    base: "NZD",
    quote: "USD",
    name: "New Zealand Dollar / US Dollar",
    pipSize: 0.0001,
    displayDecimals: 5,
    venueLabel: "Interbank",
  },
  "EUR-JPY": {
    id: "EUR-JPY",
    base: "EUR",
    quote: "JPY",
    name: "Euro / Japanese Yen",
    pipSize: 0.01,
    displayDecimals: 3,
    venueLabel: "Interbank",
  },
  "GBP-JPY": {
    id: "GBP-JPY",
    base: "GBP",
    quote: "JPY",
    name: "British Pound / Japanese Yen",
    pipSize: 0.01,
    displayDecimals: 3,
    venueLabel: "Interbank",
  },
  "USD-IDR": {
    id: "USD-IDR",
    base: "USD",
    quote: "IDR",
    name: "US Dollar / Indonesian Rupiah",
    pipSize: 1.0,
    displayDecimals: 2,
    venueLabel: "Interbank",
  },
};

export function isFxSymbol(symbol: string): boolean {
  return symbol in FX_PAIRS;
}

export function getFxMetadata(symbol: string): FxPairMetadata | undefined {
  return FX_PAIRS[symbol];
}
