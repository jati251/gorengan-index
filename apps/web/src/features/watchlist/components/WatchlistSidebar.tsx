"use client";

import React, { useState, useMemo } from "react";
import { Search, Star, TrendingUp, TrendingDown } from "lucide-react";
import { clsx } from "clsx";
import type { MarketSymbol } from "@gorengan/shared";
import { useMarketStore } from "../../../stores/marketStore";
import { useWatchlistStore } from "../../../stores/watchlistStore";
import { formatPrice, formatPercent } from "../../../utils/formatters";

interface WatchlistSidebarProps {
  symbols: MarketSymbol[];
}

export function WatchlistSidebar({ symbols }: WatchlistSidebarProps) {
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"favorites" | "all">("favorites");

  const tickers = useMarketStore((s) => s.tickers);
  const selectedSymbol = useMarketStore((s) => s.selectedSymbol);
  const setSelectedSymbol = useMarketStore((s) => s.setSelectedSymbol);

  const watchlist = useWatchlistStore((s) => s.watchlist);
  const toggleWatchlist = useWatchlistStore((s) => s.toggleWatchlist);

  // Compute filtered items directly during render (no useEffect)
  const filteredSymbols = useMemo(() => {
    return symbols.filter((sym) => {
      const matchesSearch =
        sym.id.toLowerCase().includes(search.toLowerCase()) ||
        sym.name.toLowerCase().includes(search.toLowerCase());

      if (!matchesSearch) return false;
      if (tab === "favorites") {
        return watchlist.includes(sym.id);
      }
      return true;
    });
  }, [symbols, search, tab, watchlist]);

  return (
    <div className="flex flex-col h-full bg-[#0a0e17] border-r border-slate-800 font-mono select-none">
      {/* Search & Tabs */}
      <div className="p-3 border-b border-slate-800 space-y-2">
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-500" />
          <input
            type="text"
            placeholder="Search instrument..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 pl-8 text-xs text-slate-200 placeholder-slate-500 focus:outline-hidden focus:border-emerald-500/60 transition-colors"
          />
        </div>

        <div className="grid grid-cols-2 gap-1 bg-slate-900/60 p-0.5 rounded border border-slate-800 text-[11px]">
          <button
            onClick={() => setTab("favorites")}
            className={clsx(
              "py-1 rounded font-medium transition-colors cursor-pointer flex items-center justify-center gap-1",
              tab === "favorites"
                ? "bg-slate-800 text-emerald-400 font-semibold"
                : "text-slate-400 hover:text-slate-200"
            )}
          >
            <Star className="w-3 h-3 fill-current" />
            Watchlist ({watchlist.length})
          </button>
          <button
            onClick={() => setTab("all")}
            className={clsx(
              "py-1 rounded font-medium transition-colors cursor-pointer",
              tab === "all"
                ? "bg-slate-800 text-emerald-400 font-semibold"
                : "text-slate-400 hover:text-slate-200"
            )}
          >
            All Pairs ({symbols.length})
          </button>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-800/40">
        {filteredSymbols.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-500 italic">
            No instruments found.
          </div>
        ) : (
          filteredSymbols.map((sym) => {
            const ticker = tickers[sym.id];
            const isSelected = selectedSymbol === sym.id;
            const isStarred = watchlist.includes(sym.id);
            const isPositive = (ticker?.changePercent24h ?? 0) >= 0;

            return (
              <div
                key={sym.id}
                onClick={() => setSelectedSymbol(sym.id)}
                className={clsx(
                  "p-3 flex items-center justify-between cursor-pointer transition-colors group",
                  isSelected
                    ? "bg-emerald-950/20 border-l-2 border-emerald-400"
                    : "hover:bg-slate-800/30"
                )}
              >
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleWatchlist(sym.id);
                    }}
                    className="cursor-pointer"
                  >
                    <Star
                      className={clsx(
                        "w-3.5 h-3.5 transition-transform active:scale-125",
                        isStarred
                          ? "text-yellow-400 fill-yellow-400"
                          : "text-slate-600 hover:text-slate-400"
                      )}
                    />
                  </button>

                  <div>
                    <div className="flex items-center gap-1.5">
                      <span
                        className={clsx(
                          "font-semibold text-xs",
                          isSelected ? "text-emerald-400" : "text-slate-200 group-hover:text-white"
                        )}
                      >
                        {sym.id}
                      </span>
                      {sym.isTokenizedMetal && (
                        <span className="text-[9px] px-1 py-0.2 rounded bg-yellow-950/60 text-yellow-400 border border-yellow-800/40">
                          GOLD
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-slate-500">{sym.name}</div>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-xs font-semibold text-slate-100">
                    ${formatPrice(ticker?.price)}
                  </div>
                  <div
                    className={clsx(
                      "text-[10px] font-medium flex items-center justify-end gap-0.5",
                      isPositive ? "text-emerald-400" : "text-rose-400"
                    )}
                  >
                    {isPositive ? (
                      <TrendingUp className="w-2.5 h-2.5" />
                    ) : (
                      <TrendingDown className="w-2.5 h-2.5" />
                    )}
                    {formatPercent(ticker?.changePercent24h)}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
