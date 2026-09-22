"use client";

import React, { useState, useMemo } from "react";
import { Search, Star, TrendingUp, TrendingDown } from "lucide-react";
import { motion } from "framer-motion";
import { clsx } from "clsx";
import type { MarketSymbol } from "@gorengan/shared";
import { useMarketStore, type MarketCategory } from "@/stores/marketStore";
import { useWatchlistStore } from "@/stores/watchlistStore";
import { formatPrice, formatPercent } from "@/utils/formatters";
import { formatFxPrice, isFxSymbol } from "@/features/forex";
import {
  formatEquityPrice,
  getSessionBadgeInfo,
  isEquitySymbol,
  isUsEquitySymbol,
  isIdxEquitySymbol,
} from "@/features/equities";

interface WatchlistSidebarProps {
  symbols: MarketSymbol[];
}

const CATEGORIES: { id: MarketCategory; label: string; icon: string }[] = [
  { id: "all", label: "ALL", icon: "🌐" },
  { id: "crypto", label: "CRYPTO", icon: "⚡" },
  { id: "fx", label: "FOREX", icon: "💱" },
  { id: "us_stocks", label: "US", icon: "🇺🇸" },
  { id: "idx_stocks", label: "IDX", icon: "🇮🇩" },
];

export function WatchlistSidebar({ symbols }: WatchlistSidebarProps) {
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"favorites" | "all">("favorites");

  const tickers = useMarketStore((s) => s.tickers);
  const priceDirections = useMarketStore((s) => s.priceDirections);
  const selectedSymbol = useMarketStore((s) => s.selectedSymbol);
  const setSelectedSymbol = useMarketStore((s) => s.setSelectedSymbol);
  const selectedCategory = useMarketStore((s) => s.selectedCategory);
  const setSelectedCategory = useMarketStore((s) => s.setSelectedCategory);

  const watchlist = useWatchlistStore((s) => s.watchlist);
  const toggleWatchlist = useWatchlistStore((s) => s.toggleWatchlist);

  // 1. Filter symbols by category and search query (applies to both tabs)
  const categoryMatchedSymbols = useMemo(() => {
    return symbols.filter((sym) => {
      // Category filter
      let matchesCategory = false;
      if (selectedCategory === "all") {
        matchesCategory = true;
      } else if (selectedCategory === "us_stocks") {
        matchesCategory = sym.assetClass === "us_stocks" || isUsEquitySymbol(sym.id);
      } else if (selectedCategory === "idx_stocks") {
        matchesCategory = sym.assetClass === "idx_stocks" || isIdxEquitySymbol(sym.id);
      } else if (selectedCategory === "fx") {
        matchesCategory = sym.assetClass === "fx" || isFxSymbol(sym.id);
      } else {
        matchesCategory =
          sym.assetClass === "crypto" || (!isFxSymbol(sym.id) && !isEquitySymbol(sym.id));
      }

      if (!matchesCategory) return false;

      // Search query filter
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        sym.id.toLowerCase().includes(q) ||
        sym.name.toLowerCase().includes(q)
      );
    });
  }, [symbols, search, selectedCategory]);

  // 2. Favorites subset for this active category/search
  const categoryFavorites = useMemo(() => {
    return categoryMatchedSymbols.filter((sym) => watchlist.includes(sym.id));
  }, [categoryMatchedSymbols, watchlist]);

  // 3. Current active list to display
  const displayedSymbols = tab === "favorites" ? categoryFavorites : categoryMatchedSymbols;

  const searchPlaceholder = useMemo(() => {
    switch (selectedCategory) {
      case "us_stocks":
        return "Search US stock (e.g. AAPL)...";
      case "idx_stocks":
        return "Search IDX stock (e.g. BBCA)...";
      case "fx":
        return "Search FX pair (e.g. EUR-USD)...";
      case "crypto":
        return "Search crypto (e.g. BTC)...";
      default:
        return "Search all markets...";
    }
  }, [selectedCategory]);

  return (
    <div className="flex flex-col h-full bg-[#080c16] border-r border-slate-800/90 font-mono select-none overflow-hidden min-h-0">
      {/* 1. Category Switcher (ALL | CRYPTO | FOREX | US | IDX) */}
      <div className="p-2.5 sm:p-3 border-b border-slate-800/80 space-y-2.5 shrink-0">
        <div className="grid grid-cols-5 gap-0.5 bg-[#04060b] p-0.5 rounded-lg border border-slate-800 text-[10px]">
          {CATEGORIES.map((cat) => {
            const isActive = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={clsx(
                  "relative py-1.5 px-0.5 rounded-md transition-colors cursor-pointer flex items-center justify-center font-bold tracking-tight text-center",
                  isActive
                    ? cat.id === "all"
                      ? "text-emerald-400"
                      : cat.id === "crypto"
                        ? "text-emerald-400"
                        : cat.id === "fx"
                          ? "text-blue-400"
                          : cat.id === "us_stocks"
                            ? "text-cyan-400"
                            : "text-amber-400"
                    : "text-slate-500 hover:text-slate-300"
                )}
              >
                {isActive && (
                  <motion.div
                    layoutId="activeCategoryPill"
                    className="absolute inset-0 bg-slate-800/80 rounded-md border border-slate-700/60 shadow-xs"
                    transition={{ type: "spring", stiffness: 450, damping: 35 }}
                  />
                )}
                <span className="relative z-10 flex items-center justify-center gap-0.5 truncate text-[9.5px]">
                  {cat.label}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search Input */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-500" />
          <input
            type="text"
            placeholder={searchPlaceholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[#04060b] border border-slate-800 rounded px-2.5 py-1.5 pl-8 text-xs text-slate-200 placeholder-slate-500 focus:outline-hidden focus:border-emerald-500/50 transition-colors"
          />
        </div>

        {/* Watchlist & All Tabs with accurate independent counts */}
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
              Watchlist ({categoryFavorites.length})
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
            <span className="relative z-10">All Pairs ({categoryMatchedSymbols.length})</span>
          </button>
        </div>
      </div>

      {/* Symbol List — Rendered cleanly without AnimatePresence layout shifts */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-800/40 no-scrollbar min-h-0">
        {displayedSymbols.length === 0 ? (
          tab === "favorites" ? (
            <div className="p-6 text-center text-xs flex flex-col items-center justify-center gap-2 text-slate-400">
              <Star className="w-8 h-8 text-yellow-400/25 stroke-1" />
              <p className="font-semibold text-slate-300">
                No {selectedCategory === "all" ? "pairs" : selectedCategory.toUpperCase()} in Watchlist
              </p>
              <p className="text-[11px] text-slate-500 max-w-[200px]">
                Star pairs to pin them here for instant access.
              </p>
              {categoryMatchedSymbols.length > 0 && (
                <button
                  onClick={() => setTab("all")}
                  className="mt-1 px-3 py-1 bg-slate-800/80 hover:bg-slate-700 text-emerald-400 rounded text-[11px] font-semibold transition-colors cursor-pointer border border-slate-700/60"
                >
                  Browse All Pairs ({categoryMatchedSymbols.length})
                </button>
              )}
            </div>
          ) : (
            <div className="p-8 text-center text-xs text-slate-500 italic">
              No matching pairs found.
            </div>
          )
        ) : (
          <div>
            {displayedSymbols.map((sym) => {
              const ticker = tickers[sym.id];
              const direction = priceDirections[sym.id] || "neutral";
              const isSelected = selectedSymbol === sym.id;
              const isStarred = watchlist.includes(sym.id);
              const isPositive = (ticker?.changePercent24h ?? 0) >= 0;
              const isFx = sym.assetClass === "fx" || isFxSymbol(sym.id);
              const isUs = sym.assetClass === "us_stocks" || isUsEquitySymbol(sym.id);
              const isId = sym.assetClass === "idx_stocks" || isIdxEquitySymbol(sym.id);

              let formattedPrice = `$${formatPrice(ticker?.price)}`;
              if (isFx) {
                formattedPrice = formatFxPrice(ticker?.price, sym.id, sym.displayDecimals);
              } else if (isId) {
                formattedPrice = formatEquityPrice(ticker?.price, sym.id, "IDR");
              } else if (isUs) {
                formattedPrice = formatEquityPrice(ticker?.price, sym.id, "USD");
              }

              const badgeInfo =
                isUs || isId
                  ? getSessionBadgeInfo(ticker?.sessionState, ticker?.dataQuality, isUs)
                  : null;

              return (
                <div
                  key={sym.id}
                  onClick={() => setSelectedSymbol(sym.id)}
                  className={clsx(
                    "p-3 flex items-center justify-between cursor-pointer transition-colors duration-150 group",
                    isSelected
                      ? isUs
                        ? "bg-cyan-950/25 border-l-2 border-cyan-400"
                        : isId
                          ? "bg-amber-950/25 border-l-2 border-amber-400"
                          : isFx
                            ? "bg-blue-950/25 border-l-2 border-blue-400"
                            : "bg-emerald-950/25 border-l-2 border-emerald-400"
                      : "hover:bg-slate-800/35 border-l-2 border-transparent"
                  )}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleWatchlist(sym.id);
                      }}
                      className="cursor-pointer text-slate-600 hover:text-yellow-400 shrink-0 p-0.5"
                    >
                      <Star
                        className={clsx(
                          "w-3.5 h-3.5 transition-colors",
                          isStarred
                            ? "text-yellow-400 fill-yellow-400"
                            : "text-slate-600 hover:text-slate-400"
                        )}
                      />
                    </button>

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          className={clsx(
                            "font-semibold text-xs truncate",
                            isSelected
                              ? isUs
                                ? "text-cyan-400"
                                : isId
                                  ? "text-amber-400"
                                  : isFx
                                    ? "text-blue-400"
                                    : "text-emerald-400"
                              : "text-slate-200 group-hover:text-white"
                          )}
                        >
                          {sym.id}
                        </span>

                        {/* Category badge in ALL mode */}
                        {selectedCategory === "all" && (
                          <span
                            className={clsx(
                              "text-[8px] font-bold px-1 py-0.2 rounded border",
                              isUs
                                ? "bg-cyan-950/60 text-cyan-400 border-cyan-800/40"
                                : isId
                                  ? "bg-amber-950/60 text-amber-400 border-amber-800/40"
                                  : isFx
                                    ? "bg-blue-950/60 text-blue-400 border-blue-800/40"
                                    : "bg-emerald-950/60 text-emerald-400 border-emerald-800/40"
                            )}
                          >
                            {isUs ? "US" : isId ? "IDX" : isFx ? "FX" : "CRYPTO"}
                          </span>
                        )}

                        {sym.isTokenizedMetal && (
                          <span className="text-[9px] px-1 py-0.2 rounded bg-yellow-950/70 text-yellow-400 border border-yellow-800/40">
                            GOLD
                          </span>
                        )}

                        {badgeInfo && (
                          <span
                            className={clsx(
                              "text-[8px] font-bold px-1 py-0.2 rounded border tracking-wider",
                              badgeInfo.colorClass
                            )}
                          >
                            {badgeInfo.label}
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-500 block leading-tight truncate">
                        {sym.name}
                      </span>
                    </div>
                  </div>

                  {/* Price & Direction Flash */}
                  <div className="text-right shrink-0 pl-2">
                    <div
                      className={clsx(
                        "text-xs font-semibold tabular-nums transition-colors duration-200",
                        direction === "up" && "text-emerald-400",
                        direction === "down" && "text-rose-400",
                        direction === "neutral" && "text-slate-200"
                      )}
                    >
                      {formattedPrice}
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
                      <span>{formatPercent(ticker?.changePercent24h)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
