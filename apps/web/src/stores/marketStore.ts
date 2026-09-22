import { create } from "zustand";
import type {
  MarketTicker,
  Candle,
  Timeframe,
  ProviderStatusLevel,
  AssetClass,
  FxQuoteTick,
} from "@gorengan/shared";
import type { PriceDirection } from "../types";

// Re-export for backward compatibility
export type { PriceDirection } from "../types";

/* ─── State (data only) ───────────────────────────────────────────── */

export interface MarketStoreState {
  tickers: Record<string, MarketTicker>;
  /** Price directions for flash animation e.g. { "BTC-USDT": "up" } */
  priceDirections: Record<string, PriceDirection>;
  candles: Record<string, Candle>;
  providerStatus: ProviderStatusLevel;
  lastEventAt: number;
  selectedSymbol: string;
  selectedTimeframe: Timeframe;
  selectedAssetClass: AssetClass;
  fxQuotes: Record<string, FxQuoteTick>;
  sessions: Record<string, { market: string; state: string; segment?: string; nextTransitionAt?: number; ts: number }>;

  // Technical Indicators
  showEma20: boolean;
  showEma50: boolean;
  showVolume: boolean;
}

/* ─── Actions (methods only) ──────────────────────────────────────── */

export interface MarketStoreActions {
  setTicker: (ticker: MarketTicker) => void;
  setTickers: (tickers: MarketTicker[]) => void;
  setFxQuote: (quote: FxQuoteTick) => void;
  setCandle: (candle: Candle) => void;
  setSession: (session: { market: string; state: string; segment?: string; nextTransitionAt?: number; ts: number }) => void;
  setProviderStatus: (status: ProviderStatusLevel, lastEventAt?: number) => void;
  setSelectedSymbol: (symbol: string) => void;
  setSelectedTimeframe: (timeframe: Timeframe) => void;
  setSelectedAssetClass: (assetClass: AssetClass) => void;
  toggleEma20: () => void;
  toggleEma50: () => void;
  toggleVolume: () => void;
  setSnapshot: (
    tickers: Record<string, MarketTicker>,
    candles: Record<string, Candle>,
    status?: ProviderStatusLevel
  ) => void;
}

export type MarketStore = MarketStoreState & MarketStoreActions;

/* ─── Store Implementation ────────────────────────────────────────── */

export const useMarketStore = create<MarketStore>((set) => ({
  tickers: {},
  priceDirections: {},
  candles: {},
  providerStatus: "CONNECTING",
  lastEventAt: 0,
  selectedSymbol: "BTC-USDT",
  selectedTimeframe: "1m",
  selectedAssetClass: "crypto",
  fxQuotes: {},
  sessions: {},
  showEma20: true,
  showEma50: true,
  showVolume: true,

  toggleEma20: () => set((state) => ({ showEma20: !state.showEma20 })),
  toggleEma50: () => set((state) => ({ showEma50: !state.showEma50 })),
  toggleVolume: () => set((state) => ({ showVolume: !state.showVolume })),

  setSession: (session) =>
    set((state) => ({
      sessions: { ...state.sessions, [session.market.toUpperCase()]: session },
    })),

  setSelectedAssetClass: (assetClass) =>
    set((state) => {
      let nextSymbol = state.selectedSymbol;
      let nextTimeframe = state.selectedTimeframe;

      if (assetClass === "us_stocks") {
        if (!nextSymbol.startsWith("US:")) {
          nextSymbol = "US:AAPL";
        }
        if (nextTimeframe === "1s" || nextTimeframe === "5s" || nextTimeframe === "15s") {
          nextTimeframe = "1m";
        }
      } else if (assetClass === "idx_stocks") {
        if (!nextSymbol.startsWith("ID:")) {
          nextSymbol = "ID:BBCA";
        }
        if (nextTimeframe === "1s" || nextTimeframe === "5s" || nextTimeframe === "15s") {
          nextTimeframe = "1m";
        }
      } else if (assetClass === "fx") {
        if (!nextSymbol.includes("-") || nextSymbol.endsWith("USDT") || nextSymbol.startsWith("US:") || nextSymbol.startsWith("ID:")) {
          nextSymbol = "EUR-USD";
        }
        if (nextTimeframe === "1s" || nextTimeframe === "5s" || nextTimeframe === "15s") {
          nextTimeframe = "1m";
        }
      } else if (assetClass === "crypto") {
        if (!nextSymbol.endsWith("USDT")) {
          nextSymbol = "BTC-USDT";
        }
      }

      return {
        selectedAssetClass: assetClass,
        selectedSymbol: nextSymbol,
        selectedTimeframe: nextTimeframe,
      };
    }),

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

  setFxQuote: (quote) =>
    set((state) => ({
      fxQuotes: { ...state.fxQuotes, [quote.instrument]: quote },
    })),

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

  setSelectedSymbol: (symbol) =>
    set((state) => {
      const isUs = symbol.startsWith("US:");
      const isId = symbol.startsWith("ID:");
      const isFx = !symbol.endsWith("USDT") && !isUs && !isId;

      let nextAssetClass: AssetClass = "crypto";
      if (isUs) nextAssetClass = "us_stocks";
      else if (isId) nextAssetClass = "idx_stocks";
      else if (isFx) nextAssetClass = "fx";

      let nextTimeframe = state.selectedTimeframe;
      if ((isFx || isUs || isId) && (nextTimeframe === "1s" || nextTimeframe === "5s" || nextTimeframe === "15s")) {
        nextTimeframe = "1m";
      }

      return {
        selectedSymbol: symbol,
        selectedTimeframe: nextTimeframe,
        selectedAssetClass: nextAssetClass,
      };
    }),

  setSelectedTimeframe: (timeframe) => set({ selectedTimeframe: timeframe }),

  setSnapshot: (tickers, candles, status) =>
    set((state) => ({
      tickers: { ...state.tickers, ...tickers },
      candles: { ...state.candles, ...candles },
      providerStatus: status ?? state.providerStatus,
      lastEventAt: Date.now(),
    })),
}));
