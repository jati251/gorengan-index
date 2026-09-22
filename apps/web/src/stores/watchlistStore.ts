import { create } from "zustand";

interface WatchlistState {
  watchlist: string[];
  addToWatchlist: (symbol: string) => void;
  removeFromWatchlist: (symbol: string) => void;
  toggleWatchlist: (symbol: string) => void;
  isInWatchlist: (symbol: string) => boolean;
}

const DEFAULT_WATCHLIST = ["BTC-USDT", "ETH-USDT", "SOL-USDT", "PAXG-USDT"];

export const useWatchlistStore = create<WatchlistState>((set, get) => ({
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

  isInWatchlist: (symbol) => get().watchlist.includes(symbol),
}));
