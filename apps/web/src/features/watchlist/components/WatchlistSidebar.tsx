"use client";

import React, { useState, useMemo } from "react";
import { Search, Star, TrendingUp, TrendingDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { clsx } from "clsx";
import type { MarketSymbol } from "@gorengan/shared";
import { useMarketStore } from "@/stores/marketStore";
import { useWatchlistStore } from "@/stores/watchlistStore";
import { formatPrice, formatPercent } from "@/utils/formatters";
import { formatFxPrice, isFxSymbol } from "@/features/forex";

interface WatchlistSidebarProps {
  symbols: MarketSymbol[];
}

export function WatchlistSidebar({ symbols }: WatchlistSidebarProps) {
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"favorites" | "all">("favorites");

  const tickers = useMarketStore((s) => s.tickers);
  const priceDirections = useMarketStore((s) => s.priceDirections);
  const selectedSymbol = useMarketStore((s) => s.selectedSymbol);
  const setSelectedSymbol = useMarketStore((s) => s.setSelectedSymbol);
  const selectedAssetClass = useMarketStore((s) => s.selectedAssetClass);
  const setSelectedAssetClass = useMarketStore((s) => s.setSelectedAssetClass);

  const watchlist = useWatchlistStore((s) => s.watchlist);
  const toggleWatchlist = useWatchlistStore((s) => s.toggleWatchlist);

  // Filter symbols by selectedAssetClass, tab, and search query
  const filteredSymbols = useMemo(() => {
    return symbols.filter((sym) => {
      // 1. Asset class filter
      const matchesAssetClass =
        selectedAssetClass === "fx"
          ? sym.assetClass === "fx" || isFxSymbol(sym.id)
          : sym.assetClass !== "fx" && !isFxSymbol(sym.id);

      if (!matchesAssetClass) return false;

      // 2. Search query filter
      const matchesSearch =
        sym.id.toLowerCase().includes(search.toLowerCase()) ||
        sym.name.toLowerCase().includes(search.toLowerCase());

      if (!matchesSearch) return false;

      // 3. Tab filter
      if (tab === "favorites") {
        return watchlist.includes(sym.id);
      }
      return true;
    });
  }, [symbols, search, tab, watchlist, selectedAssetClass]);

  return (
    <div className="flex flex-col h-full bg-[#080c16] border-r border-slate-800/90 font-mono select-none">
      {/* 1. Asset Class Switcher (CRYPTO | FOREX) */}
      <div className="p-3 border-b border-slate-800/80 space-y-2.5">
        <div className="grid grid-cols-2 gap-1 bg-[#04060b] p-0.5 rounded-lg border border-slate-800 text-xs">
          <button
            onClick={() => setSelectedAssetClass("crypto")}
            className={clsx(
              "relative py-1.5 rounded-md transition-colors cursor-pointer flex items-center justify-center gap-1.5 font-bold tracking-wider",
              selectedAssetClass === "crypto"
                ? "text-emerald-400"
                : "text-slate-500 hover:text-slate-300"
            )}
          >
            {selectedAssetClass === "crypto" && (
              <motion.div
                layoutId="activeAssetClassPill"
                className="absolute inset-0 bg-emerald-950/40 rounded-md border border-emerald-500/50 shadow-xs"
                transition={{ type: "spring", stiffness: 450, damping: 35 }}
              />
            )}
            <span className="relative z-10 flex items-center gap-1">
              ⚡ CRYPTO
            </span>
          </button>

          <button
            onClick={() => setSelectedAssetClass("fx")}
            className={clsx(
              "relative py-1.5 rounded-md transition-colors cursor-pointer flex items-center justify-center gap-1.5 font-bold tracking-wider",
              selectedAssetClass === "fx"
                ? "text-blue-400"
                : "text-slate-500 hover:text-slate-300"
            )}
          >
            {selectedAssetClass === "fx" && (
              <motion.div
                layoutId="activeAssetClassPill"
                className="absolute inset-0 bg-blue-950/40 rounded-md border border-blue-500/50 shadow-xs"
                transition={{ type: "spring", stiffness: 450, damping: 35 }}
              />
            )}
            <span className="relative z-10 flex items-center gap-1">
              💱 FOREX
            </span>
          </button>
        </div>

        {/* Search Input */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-500" />
          <input
            type="text"
            placeholder={selectedAssetClass === "fx" ? "Search FX pair (e.g. EUR-USD)..." : "Search crypto pair..."}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[#04060b] border border-slate-800 rounded px-2.5 py-1.5 pl-8 text-xs text-slate-200 placeholder-slate-500 focus:outline-hidden focus:border-emerald-500/50 transition-colors"
          />
        </div>

        {/* Watchlist & All Tabs */}
        <div className="grid grid-cols-2 gap-1 bg-[#04060b] p-0.5 rounded-md border border-slate-800/80 text-[11px]">
          <button
            onClick={() => setTab("favorites")}
            className={clsx(
              "relative py-1 rounded transition-colors cursor-pointer flex items-center justify-center gap-1.5",
              tab === "favorites" ? "text-emerald-400 font-bold" : "text-slate-400 hover:text-slate-200"
            )}
          >
            {tab === "favorites" && (
              <motion.div
                layoutId="watchlistTabPill"
                className="absolute inset-0 bg-slate-800/90 rounded border border-slate-700/60 shadow-xs"
                transition={{ type: "spring", stiffness: 450, damping: 35 }}
              />
            )}
            <span className="relative z-10 flex items-center gap-1.5">
              <Star className="w-3 h-3 fill-current text-yellow-400" />
              Watchlist
            </span>
          </button>

          <button
            onClick={() => setTab("all")}
            className={clsx(
              "relative py-1 rounded transition-colors cursor-pointer flex items-center justify-center",
              tab === "all" ? "text-emerald-400 font-bold" : "text-slate-400 hover:text-slate-200"
            )}
          >
            {tab === "all" && (
              <motion.div
                layoutId="watchlistTabPill"
                className="absolute inset-0 bg-slate-800/90 rounded border border-slate-700/60 shadow-xs"
                transition={{ type: "spring", stiffness: 450, damping: 35 }}
              />
            )}
            <span className="relative z-10">All Pairs ({filteredSymbols.length})</span>
          </button>
        </div>
      </div>

      {/* Symbol List with Animations */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-800/40 no-scrollbar">
        {filteredSymbols.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500 italic">
            No {selectedAssetClass === "fx" ? "Forex pairs" : "Crypto pairs"} found.
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {filteredSymbols.map((sym) => {
              const ticker = tickers[sym.id];
              const direction = priceDirections[sym.id] || "neutral";
              const isSelected = selectedSymbol === sym.id;
              const isStarred = watchlist.includes(sym.id);
              const isPositive = (ticker?.changePercent24h ?? 0) >= 0;
              const isFx = sym.assetClass === "fx" || isFxSymbol(sym.id);

              const formattedPrice = isFx
                ? formatFxPrice(ticker?.price, sym.id, sym.displayDecimals)
                : `$${formatPrice(ticker?.price)}`;

              return (
                <motion.div
                  key={sym.id}
                  onClick={() => setSelectedSymbol(sym.id)}
                  initial={{ opacity: 0, y: 3 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className={clsx(
                    "p-3 flex items-center justify-between cursor-pointer transition-colors duration-150 group",
                    isSelected
                      ? isFx
                        ? "bg-blue-950/25 border-l-2 border-blue-400"
                        : "bg-emerald-950/25 border-l-2 border-emerald-400"
                      : "hover:bg-slate-800/35 border-l-2 border-transparent"
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    <motion.button
                      whileTap={{ scale: 1.4 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleWatchlist(sym.id);
                      }}
                      className="cursor-pointer text-slate-600 hover:text-yellow-400"
                    >
                      <Star
                        className={clsx(
                          "w-3.5 h-3.5 transition-colors",
                          isStarred
                            ? "text-yellow-400 fill-yellow-400"
                            : "text-slate-600 hover:text-slate-400"
                        )}
                      />
                    </motion.button>

                    <div>
                      <div className="flex items-center gap-1.5">
                        <span
                          className={clsx(
                            "font-semibold text-xs",
                            isSelected
                              ? isFx
                                ? "text-blue-400"
                                : "text-emerald-400"
                              : "text-slate-200 group-hover:text-white"
                          )}
                        >
                          {sym.id}
                        </span>
                        {sym.isTokenizedMetal && (
                          <span className="text-[9px] px-1 py-0.2 rounded bg-yellow-950/70 text-yellow-400 border border-yellow-800/40">
                            GOLD
                          </span>
                        )}
                        {isFx && (
                          <span className="text-[9px] px-1 py-0.2 rounded bg-blue-950/60 text-blue-400 border border-blue-800/40">
                            FX
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-500 block leading-tight">
                        {sym.name}
                      </span>
                    </div>
                  </div>

                  {/* Price & Direction Flash */}
                  <div className="text-right">
                    <motion.div
                      key={ticker?.price}
                      initial={{ scale: 1.05 }}
                      animate={{ scale: 1 }}
                      className={clsx(
                        "text-xs font-semibold tabular-nums transition-colors duration-200",
                        direction === "up" && "text-emerald-400",
                        direction === "down" && "text-rose-400",
                        direction === "neutral" && "text-slate-200"
                      )}
                    >
                      {formattedPrice}
                    </motion.div>

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
                      <span>{formatPercent(ticker?.changePercent24h)}</span>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
