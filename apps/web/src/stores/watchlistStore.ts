import { create } from "zustand";
import { persist } from "zustand/middleware";

/* ─── State ───────────────────────────────────────────────────────── */

interface WatchlistStoreState {
  watchlist: string[];
}

/* ─── Actions ─────────────────────────────────────────────────────── */

interface WatchlistStoreActions {
  addToWatchlist: (symbol: string) => void;
  removeFromWatchlist: (symbol: string) => void;
  toggleWatchlist: (symbol: string) => void;
  isWatchlisted: (symbol: string) => boolean;
}

type WatchlistStore = WatchlistStoreState & WatchlistStoreActions;

export const DEFAULT_WATCHLIST = [
  "BTC-USDT",
  "ETH-USDT",
  "SOL-USDT",
  "EUR-USD",
  "USD-JPY",
  "US:AAPL",
  "US:NVDA",
  "ID:BBCA",
  "ID:BBRI",
];

export const useWatchlistStore = create<WatchlistStore>()(
  persist(
    (set, get) => ({
      watchlist: DEFAULT_WATCHLIST,

      addToWatchlist: (symbol) =>
        set((state) => ({
          watchlist: state.watchlist.includes(symbol)
            ? state.watchlist
            : [...state.watchlist, symbol],
        })),

      removeFromWatchlist: (symbol) =>
        set((state) => ({
          watchlist: state.watchlist.filter((s) => s !== symbol),
        })),

      toggleWatchlist: (symbol) => {
        const list = get().watchlist;
        if (list.includes(symbol)) {
          set({ watchlist: list.filter((s) => s !== symbol) });
        } else {
          set({ watchlist: [...list, symbol] });
        }
      },

      isWatchlisted: (symbol) => get().watchlist.includes(symbol),
    }),
    {
      name: "gorengan-watchlist",
    }
  )
);
