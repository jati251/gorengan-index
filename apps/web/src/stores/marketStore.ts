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

export type MarketCategory = "all" | "crypto" | "fx" | "us_stocks" | "idx_stocks";

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
  selectedCategory: MarketCategory;
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
  setSelectedCategory: (category: MarketCategory) => void;
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

// Flash timeout registry to auto-decay directional price pulses back to neutral
const flashTimeouts: Record<string, ReturnType<typeof setTimeout>> = {};

const scheduleFlashReset = (symbol: string, resetFn: () => void) => {
  if (flashTimeouts[symbol]) {
    clearTimeout(flashTimeouts[symbol]);
  }
  flashTimeouts[symbol] = setTimeout(() => {
    resetFn();
    delete flashTimeouts[symbol];
  }, 850);
};

const sameTicker = (a: MarketTicker, b: MarketTicker) => {
  const keys = Object.keys(b) as (keyof MarketTicker)[];
  return keys.length === Object.keys(a).length && keys.every((key) => Object.is(a[key], b[key]));
};

export const useMarketStore = create<MarketStore>((set, get) => ({
  tickers: {},
  priceDirections: {},
  candles: {},
  providerStatus: "CONNECTING",
  lastEventAt: 0,
  selectedSymbol: "BTC-USDT",
  selectedTimeframe: "1m",
  selectedAssetClass: "crypto",
  selectedCategory: "all",
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

  setSelectedCategory: (category) =>
    set((state) => {
      if (category === "all") {
        return { selectedCategory: "all" };
      }
      return {
        selectedCategory: category,
        selectedAssetClass: category as AssetClass,
      };
    }),

  setSelectedAssetClass: (assetClass) => {
    get().setSelectedCategory(assetClass as MarketCategory);
  },

  setTicker: (ticker) => get().setTickers([ticker]),

  setTickers: (tickers) =>
    set((state) => {
      const newMap = { ...state.tickers };
      const directions = { ...state.priceDirections };
      let lastEventAt = state.lastEventAt;
      let changed = false;
      for (const t of tickers) {
        if (!t.symbol || !Number.isFinite(t.price)) continue;
        const previous = newMap[t.symbol];
        if (previous && t.timestamp < previous.timestamp) continue;
        if (previous && sameTicker(previous, t)) continue;
        if (previous && typeof previous.price === "number" && typeof t.price === "number") {
          if (t.price !== previous.price) {
            directions[t.symbol] = t.price > previous.price ? "up" : "down";
            scheduleFlashReset(t.symbol, () => {
              set((current) => current.priceDirections[t.symbol] === "neutral" ? current : ({
                priceDirections: { ...current.priceDirections, [t.symbol]: "neutral" },
              }));
            });
          }
        }
        newMap[t.symbol] = t;
        changed = true;
        lastEventAt = Math.max(lastEventAt, t.timestamp || Date.now());
      }
      return changed ? { tickers: newMap, priceDirections: directions, lastEventAt } : state;
    }),

  setFxQuote: (quote) =>
    set((state) => {
      const prevTicker = state.tickers[quote.instrument];
      let direction: PriceDirection = "neutral";
      if (prevTicker && typeof prevTicker.price === "number" && typeof quote.mid === "number") {
        if (quote.mid > prevTicker.price) direction = "up";
        else if (quote.mid < prevTicker.price) direction = "down";
        else direction = state.priceDirections[quote.instrument] || "neutral";
      }

      if (direction !== "neutral" && prevTicker && prevTicker.price !== quote.mid) {
        scheduleFlashReset(quote.instrument, () => {
          set((s) => {
            if (s.priceDirections[quote.instrument] === "neutral") return s;
            return {
              priceDirections: {
                ...s.priceDirections,
                [quote.instrument]: "neutral",
              },
            };
          });
        });
      }

      const updatedTicker = prevTicker
        ? {
            ...prevTicker,
            price: quote.mid,
            bid: quote.bid,
            ask: quote.ask,
            spread: quote.spread,
            timestamp: quote.providerTs || Date.now(),
          }
        : undefined;

      return {
        fxQuotes: { ...state.fxQuotes, [quote.instrument]: quote },
        ...(updatedTicker ? { tickers: { ...state.tickers, [quote.instrument]: updatedTicker } } : {}),
        ...(direction !== "neutral" ? { priceDirections: { ...state.priceDirections, [quote.instrument]: direction } } : {}),
      };
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

  setSnapshot: (tickers, candles, status) => {
    get().setTickers(Object.values(tickers));
    set((state) => ({
      candles: { ...state.candles, ...candles },
      providerStatus: status ?? state.providerStatus,
      lastEventAt: Date.now(),
    }));
  },
}));
