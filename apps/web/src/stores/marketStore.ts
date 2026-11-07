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

export interface RealtimeBatchPayload {
  tickers?: MarketTicker[];
  quotes?: FxQuoteTick[];
  candles?: Candle[];
}

export interface MarketStoreActions {
  setTicker: (ticker: MarketTicker) => void;
  setTickers: (tickers: MarketTicker[]) => void;
  setFxQuote: (quote: FxQuoteTick) => void;
  setCandle: (candle: Candle) => void;
  setCandles: (candles: Candle[]) => void;
  applyRealtimeBatch: (batch: RealtimeBatchPayload) => void;
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

// Coalesced flash expiry registry to decay directional price pulses in a single batched state update
const flashExpiries = new Map<string, number>();
let flashSweepTimer: ReturnType<typeof setTimeout> | null = null;

const scheduleCoalescedFlashSweep = (
  symbols: string[],
  setState: (updater: (state: MarketStore) => Partial<MarketStore> | MarketStore) => void
) => {
  if (symbols.length === 0) return;
  const expireAt = Date.now() + 850;
  for (let i = 0; i < symbols.length; i++) {
    flashExpiries.set(symbols[i], expireAt);
  }

  if (flashSweepTimer !== null) return;

  const runSweep = () => {
    flashSweepTimer = null;
    const now = Date.now();
    const expired: string[] = [];
    let earliestRemaining = Number.POSITIVE_INFINITY;

    for (const [sym, exp] of flashExpiries.entries()) {
      if (exp <= now + 25) {
        expired.push(sym);
        flashExpiries.delete(sym);
      } else if (exp < earliestRemaining) {
        earliestRemaining = exp;
      }
    }

    if (expired.length > 0) {
      setState((current) => {
        let nextDirections: Record<string, PriceDirection> | null = null;
        for (let i = 0; i < expired.length; i++) {
          const sym = expired[i];
          if (current.priceDirections[sym] && current.priceDirections[sym] !== "neutral") {
            if (!nextDirections) nextDirections = { ...current.priceDirections };
            nextDirections[sym] = "neutral";
          }
        }
        return nextDirections ? { priceDirections: nextDirections } : current;
      });
    }

    if (flashExpiries.size > 0 && Number.isFinite(earliestRemaining)) {
      flashSweepTimer = setTimeout(runSweep, Math.max(50, earliestRemaining - Date.now()));
    }
  };

  flashSweepTimer = setTimeout(runSweep, 850);
};

const sameTicker = (a: MarketTicker, b: MarketTicker) =>
  a.price === b.price &&
  a.timestamp === b.timestamp &&
  a.volume24h === b.volume24h &&
  a.change24h === b.change24h &&
  a.changePercent24h === b.changePercent24h &&
  a.high24h === b.high24h &&
  a.low24h === b.low24h &&
  a.bid === b.bid &&
  a.ask === b.ask;

const sameCandle = (a: Candle | undefined, b: Candle) =>
  a !== undefined &&
  a.openTime === b.openTime &&
  a.close === b.close &&
  a.high === b.high &&
  a.low === b.low &&
  a.open === b.open &&
  a.volume === b.volume &&
  a.finalized === b.finalized;

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

  setSelectedCategory: (category) => {
    if (category === "all") {
      set({ selectedCategory: "all" });
    } else {
      set({
        selectedCategory: category,
        selectedAssetClass: category as AssetClass,
      });
    }
  },

  setSelectedAssetClass: (assetClass) => {
    get().setSelectedCategory(assetClass as MarketCategory);
  },

  setTicker: (ticker) => get().applyRealtimeBatch({ tickers: [ticker] }),

  setTickers: (tickers) => get().applyRealtimeBatch({ tickers }),

  setFxQuote: (quote) => get().applyRealtimeBatch({ quotes: [quote] }),

  setCandle: (candle) => get().applyRealtimeBatch({ candles: [candle] }),

  setCandles: (candles) => get().applyRealtimeBatch({ candles }),

  applyRealtimeBatch: ({ tickers, quotes, candles }) => {
    const flashedSymbols: string[] = [];

    set((state) => {
      let nextTickers: Record<string, MarketTicker> | null = null;
      let nextDirections: Record<string, PriceDirection> | null = null;
      let nextFxQuotes: Record<string, FxQuoteTick> | null = null;
      let nextCandles: Record<string, Candle> | null = null;
      let lastEventAt = state.lastEventAt;

      if (tickers && tickers.length > 0) {
        for (let i = 0; i < tickers.length; i++) {
          const t = tickers[i];
          if (!t.symbol || !Number.isFinite(t.price)) continue;
          const currentMap = nextTickers ?? state.tickers;
          const previous = currentMap[t.symbol];
          if (previous && t.timestamp < previous.timestamp) continue;
          if (previous && sameTicker(previous, t)) continue;

          if (previous && typeof previous.price === "number" && t.price !== previous.price) {
            if (!nextDirections) nextDirections = { ...state.priceDirections };
            nextDirections[t.symbol] = t.price > previous.price ? "up" : "down";
            flashedSymbols.push(t.symbol);
          }

          if (!nextTickers) nextTickers = { ...state.tickers };
          nextTickers[t.symbol] = t;
          if (t.timestamp && t.timestamp > lastEventAt) {
            lastEventAt = t.timestamp;
          }
        }
      }

      if (quotes && quotes.length > 0) {
        for (let i = 0; i < quotes.length; i++) {
          const quote = quotes[i];
          if (!quote.instrument) continue;
          const currentTickers = nextTickers ?? state.tickers;
          const prevTicker = currentTickers[quote.instrument];

          if (prevTicker && typeof prevTicker.price === "number" && typeof quote.mid === "number") {
            if (quote.mid !== prevTicker.price) {
              if (!nextDirections) nextDirections = { ...state.priceDirections };
              nextDirections[quote.instrument] = quote.mid > prevTicker.price ? "up" : "down";
              flashedSymbols.push(quote.instrument);
            }
          }

          if (!nextFxQuotes) nextFxQuotes = { ...state.fxQuotes };
          nextFxQuotes[quote.instrument] = quote;

          if (prevTicker) {
            if (!nextTickers) nextTickers = { ...state.tickers };
            nextTickers[quote.instrument] = {
              ...prevTicker,
              price: quote.mid,
              bid: quote.bid,
              ask: quote.ask,
              spread: quote.spread,
              timestamp: quote.providerTs || Date.now(),
            };
          }
        }
      }

      if (candles && candles.length > 0) {
        for (let i = 0; i < candles.length; i++) {
          const c = candles[i];
          if (!c.symbol || !c.timeframe) continue;
          const key = `${c.symbol}:${c.timeframe}`;
          const currentCandles = nextCandles ?? state.candles;
          const prevCandle = currentCandles[key];
          if (prevCandle && c.openTime < prevCandle.openTime) continue;
          if (sameCandle(prevCandle, c)) continue;

          if (!nextCandles) nextCandles = { ...state.candles };
          nextCandles[key] = c;
        }
      }

      if (!nextTickers && !nextDirections && !nextFxQuotes && !nextCandles) {
        return state;
      }

      const partial: Partial<MarketStoreState> = {};
      if (nextTickers) partial.tickers = nextTickers;
      if (nextDirections) partial.priceDirections = nextDirections;
      if (nextFxQuotes) partial.fxQuotes = nextFxQuotes;
      if (nextCandles) partial.candles = nextCandles;
      if (lastEventAt !== state.lastEventAt) partial.lastEventAt = lastEventAt;
      return partial;
    });

    if (flashedSymbols.length > 0) {
      scheduleCoalescedFlashSweep(flashedSymbols, set);
    }
  },

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
