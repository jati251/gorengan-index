export type Timeframe =
  | "1s"
  | "5s"
  | "15s"
  | "30s"
  | "1m"
  | "5m"
  | "15m"
  | "30m"
  | "1h"
  | "4h"
  | "1d"
  | "1w";

export interface Candle {
  symbol: string;
  timeframe: Timeframe;
  openTime: number; // Unix ms
  closeTime: number; // Unix ms
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  trades?: number;
  finalized: boolean;
  provider?: string;
}

export const TIMEFRAME_MS: Record<Timeframe, number> = {
  "1s": 1000,
  "5s": 5 * 1000,
  "15s": 15 * 1000,
  "30s": 30 * 1000,
  "1m": 60 * 1000,
  "5m": 5 * 60 * 1000,
  "15m": 15 * 60 * 1000,
  "30m": 30 * 60 * 1000,
  "1h": 60 * 60 * 1000,
  "4h": 4 * 60 * 60 * 1000,
  "1d": 24 * 60 * 60 * 1000,
  "1w": 7 * 24 * 60 * 60 * 1000,
};

export function timeframeToMs(timeframe: Timeframe): number {
  return TIMEFRAME_MS[timeframe];
}
