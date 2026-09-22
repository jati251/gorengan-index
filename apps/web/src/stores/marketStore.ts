import { create } from "zustand";
import type {
  MarketTicker,
  Candle,
  Timeframe,
  ProviderStatusLevel,
} from "@gorengan/shared";

export type PriceDirection = "up" | "down" | "neutral";

export interface MarketState {
  tickers: Record<string, MarketTicker>;
  // Price directions for flash animation e.g. { "BTC-USDT": "up" }
  priceDirections: Record<string, PriceDirection>;
  candles: Record<string, Candle>;
  providerStatus: ProviderStatusLevel;
  lastEventAt: number;
  selectedSymbol: string;
  selectedTimeframe: Timeframe;

  // Technical Indicators
  showEma20: boolean;
  showEma50: boolean;
  showVolume: boolean;

  // Actions
  setTicker: (ticker: MarketTicker) => void;
  setTickers: (tickers: MarketTicker[]) => void;
  setCandle: (candle: Candle) => void;
  setProviderStatus: (status: ProviderStatusLevel, lastEventAt?: number) => void;
  setSelectedSymbol: (symbol: string) => void;
  setSelectedTimeframe: (timeframe: Timeframe) => void;
  toggleEma20: () => void;
  toggleEma50: () => void;
  toggleVolume: () => void;
  setSnapshot: (
    tickers: Record<string, MarketTicker>,
    candles: Record<string, Candle>,
    status?: ProviderStatusLevel
  ) => void;
}

export const useMarketStore = create<MarketState>((set) => ({
  tickers: {},
  priceDirections: {},
  candles: {},
  providerStatus: "CONNECTING",
  lastEventAt: 0,
  selectedSymbol: "BTC-USDT",
  selectedTimeframe: "1m",
  showEma20: true,
  showEma50: true,
  showVolume: true,

  toggleEma20: () => set((state) => ({ showEma20: !state.showEma20 })),
  toggleEma50: () => set((state) => ({ showEma50: !state.showEma50 })),
  toggleVolume: () => set((state) => ({ showVolume: !state.showVolume })),

  setTicker: (ticker) =>
    set((state) => {
      const prev = state.tickers[ticker.symbol];
      let direction: PriceDirection = "neutral";
      if (prev) {
        if (ticker.price > prev.price) direction = "up";
        else if (ticker.price < prev.price) direction = "down";
        else direction = state.priceDirections[ticker.symbol] || "neutral";
      }

      return {
        tickers: { ...state.tickers, [ticker.symbol]: ticker },
        priceDirections: { ...state.priceDirections, [ticker.symbol]: direction },
        lastEventAt: ticker.timestamp || Date.now(),
      };
    }),

  setTickers: (tickers) =>
    set((state) => {
      const newMap = { ...state.tickers };
      for (const t of tickers) {
        newMap[t.symbol] = t;
      }
      return { tickers: newMap };
    }),

  setCandle: (candle) =>
    set((state) => ({
      candles: {
        ...state.candles,
        [`${candle.symbol}:${candle.timeframe}`]: candle,
      },
    })),

  setProviderStatus: (status, lastEventAt) =>
    set((state) => ({
      providerStatus: status,
      lastEventAt: lastEventAt ?? state.lastEventAt,
    })),

  setSelectedSymbol: (symbol) => set({ selectedSymbol: symbol }),

  setSelectedTimeframe: (timeframe) => set({ selectedTimeframe: timeframe }),

  setSnapshot: (tickers, candles, status) =>
    set((state) => ({
      tickers: { ...state.tickers, ...tickers },
      candles: { ...state.candles, ...candles },
      providerStatus: status ?? state.providerStatus,
      lastEventAt: Date.now(),
    })),
}));
