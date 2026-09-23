"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
import { Search, Star, TrendingUp, TrendingDown, X, SearchX } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
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
  onSelectSymbol?: (symbolId: string) => void;
}

const CATEGORIES: { id: MarketCategory; label: string; icon: string }[] = [
  { id: "all", label: "ALL", icon: "•" },
  { id: "crypto", label: "CRYPTO", icon: "•" },
  { id: "fx", label: "FOREX", icon: "•" },
  { id: "us_stocks", label: "US", icon: "•" },
  { id: "idx_stocks", label: "IDX", icon: "•" },
];

export function WatchlistSidebar({ symbols, onSelectSymbol }: WatchlistSidebarProps) {
  const [search, setSearch] = useState("");
  const [committedSearch, setCommittedSearch] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const [tab, setTab] = useState<"favorites" | "all">("favorites");
  const [trendFilter, setTrendFilter] = useState<"all" | "gainers" | "losers">("all");

  const tickers = useMarketStore((s) => s.tickers);
  const priceDirections = useMarketStore((s) => s.priceDirections);
  const selectedSymbol = useMarketStore((s) => s.selectedSymbol);

  // Close suggestion dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Compute search suggestions across all symbols
  const suggestions = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return symbols
      .filter(
        (s) =>
          s.id.toLowerCase().includes(q) ||
          s.name.toLowerCase().includes(q) ||
          s.base.toLowerCase().includes(q)
      )
      .slice(0, 6);
  }, [symbols, search]);
  const setSelectedSymbol = useMarketStore((s) => s.setSelectedSymbol);
  const selectedCategory = useMarketStore((s) => s.selectedCategory);
  const setSelectedCategory = useMarketStore((s) => s.setSelectedCategory);

  const watchlist = useWatchlistStore((s) => s.watchlist);
  const toggleWatchlist = useWatchlistStore((s) => s.toggleWatchlist);

  // 1. Filter symbols by category and search query (only applies committed search)
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

      // Search query filter (applies only after Enter or dropdown selection)
      if (!committedSearch.trim()) return true;
      const q = committedSearch.toLowerCase();
      return (
        sym.id.toLowerCase().includes(q) ||
        sym.name.toLowerCase().includes(q)
      );
    });
  }, [symbols, committedSearch, selectedCategory]);

  // 2. Favorites subset for this active category/search
  const categoryFavorites = useMemo(() => {
    return categoryMatchedSymbols.filter((sym) => watchlist.includes(sym.id));
  }, [categoryMatchedSymbols, watchlist]);

  // 3. Current active base list before trend filter
  const baseSymbols = tab === "favorites" ? categoryFavorites : categoryMatchedSymbols;

  // 4. Trend counts (Gainers vs Losers)
  const { gainersCount, losersCount } = useMemo(() => {
    let g = 0;
    let l = 0;
    for (const sym of baseSymbols) {
      const chg = tickers[sym.id]?.changePercent24h ?? 0;
      if (chg > 0) g++;
      else if (chg < 0) l++;
    }
    return { gainersCount: g, losersCount: l };
  }, [baseSymbols, tickers]);

  // 5. Final displayed symbols with Gainers/Losers filtering
  const displayedSymbols = useMemo(() => {
    if (trendFilter === "gainers") {
      return baseSymbols.filter((sym) => (tickers[sym.id]?.changePercent24h ?? 0) > 0);
    }
    if (trendFilter === "losers") {
      return baseSymbols.filter((sym) => (tickers[sym.id]?.changePercent24h ?? 0) < 0);
    }
    return baseSymbols;
  }, [baseSymbols, trendFilter, tickers]);

  const searchPlaceholder = useMemo(() => {
    switch (selectedCategory) {
      case "us_stocks":
        return "Search US stocks";
      case "idx_stocks":
        return "Search IDX stocks";
      case "fx":
        return "Search FX pairs";
      case "crypto":
        return "Search crypto";
      default:
        return "Search markets";
    }
  }, [selectedCategory]);

  return (
    <div className="terminal-watchlist flex flex-col h-full bg-[#3c3f5f] font-mono select-none overflow-hidden min-h-0">
      {/* 1. Category Switcher (ALL | CRYPTO | FOREX | US | IDX) */}
      <div className="p-2.5 sm:p-3 border-b border-white/[0.06] bg-white/[0.01] space-y-2.5 shrink-0">
        <div className="grid grid-cols-5 gap-0.5 bg-[#2a2839] p-0.5 rounded-lg border border-white/[0.07] text-[10px] ">
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
                    : "text-slate-400 hover:text-slate-200"
                )}
              >
                {isActive && (
                  <motion.div
                    layoutId="activeCategoryPill"
                    className="absolute inset-0 bg-white/[0.09] rounded-md border border-white/[0.14] shadow-xs"
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

        {/* Search Input with Suggestion Dropdown */}
        <div ref={searchContainerRef} className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder={searchPlaceholder}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setIsDropdownOpen(true);
            }}
            onFocus={() => {
              if (search.trim().length > 0) setIsDropdownOpen(true);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                setCommittedSearch(search.trim());
                setIsDropdownOpen(false);
              } else if (e.key === "Escape") {
                setIsDropdownOpen(false);
              }
            }}
            className="w-full bg-[#2a2839] border border-white/[0.08] focus:border-emerald-500/50 rounded-lg px-2.5 py-1.5 pl-8 pr-16 text-xs text-slate-100 placeholder-slate-500 focus:outline-hidden transition-all"
          />
          {search && (
            <div className="absolute right-2 top-2 flex items-center gap-1.5">
              <span className="text-[9px] font-mono text-emerald-400/80 bg-emerald-500/10 border border-emerald-500/25 px-1 rounded">
                ↵
              </span>
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setCommittedSearch("");
                  setIsDropdownOpen(false);
                }}
                className="text-slate-400 hover:text-white cursor-pointer"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Suggestion Dropdown with Framer Motion */}
          <AnimatePresence>
            {isDropdownOpen && search.trim().length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -6, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.98 }}
                transition={{ duration: 0.16, ease: "easeOut" }}
                className="absolute left-0 right-0 top-full mt-1 z-50 bg-[#2a2839] border border-white/[0.14] rounded-lg shadow-2xl backdrop-blur-xl overflow-hidden font-mono text-left"
              >
                <div className="px-2.5 py-1 bg-[#3c3f5f]/90 border-b border-white/[0.08] text-[9px] uppercase tracking-wider text-slate-400 font-semibold flex items-center justify-between">
                  <span>Matching Markets</span>
                  <span>{suggestions.length} results</span>
                </div>
                {suggestions.length === 0 ? (
                  <div className="p-2.5 text-center text-xs text-slate-400 italic">
                    No matching symbol · Press Enter to search
                  </div>
                ) : (
                  <div className="max-h-[220px] overflow-y-auto divide-y divide-white/[0.04]">
                    {suggestions.map((sym) => {
                      const ticker = tickers[sym.id];
                      const isPositive = (ticker?.changePercent24h ?? 0) >= 0;
                      return (
                        <button
                          key={sym.id}
                          type="button"
                          onClick={() => {
                            setSelectedSymbol(sym.id);
                            onSelectSymbol?.(sym.id);
                            setIsDropdownOpen(false);
                            setSearch(sym.id);
                            setCommittedSearch(sym.id);
                          }}
                          className="w-full text-left px-2.5 py-1.5 flex items-center justify-between gap-1.5 hover:bg-white/[0.06] transition-colors cursor-pointer"
                        >
                          <div className="min-w-0">
                            <div className="font-bold text-xs text-emerald-300">{sym.id}</div>
                            <div className="text-[10px] text-slate-400 truncate">{sym.name}</div>
                          </div>
                          <div className="text-right shrink-0">
                            <span
                              className={clsx(
                                "text-[10px] px-1 py-0.2 rounded font-semibold tabular-nums",
                                isPositive ? "bg-emerald-500/20 text-emerald-400" : "bg-rose-500/20 text-rose-400"
                              )}
                            >
                              {formatPercent(ticker?.changePercent24h)}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Watchlist & All Tabs with accurate independent counts */}
        <div className="grid grid-cols-2 gap-1 bg-[#2a2839] p-0.5 rounded-lg border border-white/[0.07] text-[11px] ">
          <button
            onClick={() => setTab("favorites")}
            className={clsx(
              "relative py-1 rounded-md transition-colors cursor-pointer flex items-center justify-center gap-1.5",
              tab === "favorites" ? "text-emerald-400 font-bold" : "text-slate-400 hover:text-slate-200"
            )}
          >
            {tab === "favorites" && (
              <motion.div
                layoutId="watchlistTabPill"
                className="absolute inset-0 bg-white/[0.09] rounded-md border border-white/[0.14] shadow-xs"
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
              "relative py-1 rounded-md transition-colors cursor-pointer flex items-center justify-center",
              tab === "all" ? "text-emerald-400 font-bold" : "text-slate-400 hover:text-slate-200"
            )}
          >
            {tab === "all" && (
              <motion.div
                layoutId="watchlistTabPill"
                className="absolute inset-0 bg-white/[0.09] rounded-md border border-white/[0.14] shadow-xs"
                transition={{ type: "spring", stiffness: 450, damping: 35 }}
              />
            )}
            <span className="relative z-10">All markets ({categoryMatchedSymbols.length})</span>
          </button>
        </div>

        {/* Trend Filter (ALL | GAINERS | LOSERS) */}
        <div className="grid grid-cols-3 gap-1 bg-black/30 p-0.5 rounded-lg border border-white/[0.05] text-[10px]">
          <button
            type="button"
            onClick={() => setTrendFilter("all")}
            className={clsx(
              "py-1 px-1 rounded-md transition-all cursor-pointer font-semibold text-center border",
              trendFilter === "all"
                ? "bg-white/[0.08] text-white border-white/[0.18] shadow-xs"
                : "text-slate-400 border-transparent hover:text-slate-200 hover:bg-white/[0.03]"
            )}
          >
            All ({baseSymbols.length})
          </button>
          <button
            type="button"
            onClick={() => setTrendFilter("gainers")}
            className={clsx(
              "py-1 px-1 rounded-md transition-all cursor-pointer font-semibold text-center border flex items-center justify-center gap-1",
              trendFilter === "gainers"
                ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40  font-bold"
                : "text-emerald-400/80 border-transparent hover:text-emerald-300 hover:bg-emerald-500/10"
            )}
          >
            <TrendingUp className="w-2.5 h-2.5 text-emerald-400" />
            <span>Gainers ({gainersCount})</span>
          </button>
          <button
            type="button"
            onClick={() => setTrendFilter("losers")}
            className={clsx(
              "py-1 px-1 rounded-md transition-all cursor-pointer font-semibold text-center border flex items-center justify-center gap-1",
              trendFilter === "losers"
                ? "bg-rose-500/20 text-rose-300 border-rose-500/40  font-bold"
                : "text-rose-400/80 border-transparent hover:text-rose-300 hover:bg-rose-500/10"
            )}
          >
            <TrendingDown className="w-2.5 h-2.5 text-rose-400" />
            <span>Losers ({losersCount})</span>
          </button>
        </div>
      </div>

      {/* Symbol List — Rendered cleanly without AnimatePresence layout shifts */}
      <div className="flex-1 overflow-y-auto divide-y divide-white/[0.04] no-scrollbar min-h-0">
        {displayedSymbols.length === 0 ? (
          tab === "favorites" ? (
            <div className="p-6 text-center text-xs flex flex-col items-center justify-center gap-2 text-slate-400">
              <Star className="w-8 h-8 text-yellow-400/25 stroke-1" />
              <p className="font-semibold text-slate-300">
                No saved markets here
              </p>
              <p className="text-[11px] text-slate-500 max-w-[200px]">
                Use the star to save a market.
              </p>
              {categoryMatchedSymbols.length > 0 && (
                <button
                  onClick={() => setTab("all")}
                  className="mt-1 px-3 py-1 bg-white/[0.06] hover:bg-white/[0.1] text-emerald-400 rounded-md text-[11px] font-semibold transition-colors cursor-pointer border border-white/[0.09]"
                >
                  Browse markets ({categoryMatchedSymbols.length})
                </button>
              )}
            </div>
          ) : (
            <div className="p-6 text-center text-xs flex flex-col items-center justify-center gap-2 text-slate-400 font-mono">
              <SearchX className="w-8 h-8 text-slate-500 mb-1" />
              <p className="font-semibold text-slate-300">
                No markets found
              </p>
              <p className="text-[11px] text-slate-500 max-w-[200px]">
                {committedSearch ? `No symbols match "${committedSearch}"` : "No markets match current filters."}
              </p>
              {committedSearch && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    setCommittedSearch("");
                  }}
                  className="mt-1 px-3 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-md text-[11px] font-semibold transition-colors cursor-pointer border border-emerald-500/25"
                >
                  Clear Search
                </button>
              )}
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
                  role="button"
                  tabIndex={0}
                  aria-label={`Show ${sym.name} chart`}
                  onClick={() => {
                    setSelectedSymbol(sym.id);
                    onSelectSymbol?.(sym.id);
                  }}
                  onKeyDown={(event) => {
                    if (event.target !== event.currentTarget) return;
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setSelectedSymbol(sym.id);
                      onSelectSymbol?.(sym.id);
                    }
                  }}
                  className={clsx(
                    "p-3 flex items-center justify-between cursor-pointer transition-all duration-150 group",
                    isSelected
                      ? isUs
                        ? "bg-cyan-500/[0.12] border-l-2 border-cyan-400 "
                        : isId
                          ? "bg-amber-500/[0.12] border-l-2 border-amber-400 "
                          : isFx
                            ? "bg-blue-500/[0.12] border-l-2 border-blue-400 "
                            : "bg-emerald-500/[0.12] border-l-2 border-emerald-400 "
                      : "hover:bg-white/[0.035] border-l-2 border-transparent"
                  )}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleWatchlist(sym.id);
                      }}
                      aria-label={`${isStarred ? "Remove" : "Add"} ${sym.id} ${isStarred ? "from" : "to"} watchlist`}
                      aria-pressed={isStarred}
                      className="cursor-pointer text-slate-400 hover:text-yellow-400 shrink-0 min-w-8 min-h-8 flex items-center justify-center"
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
                      data-direction={direction}
                      className={clsx(
                        "text-xs font-semibold tabular-nums px-1.5 py-0.5 border rounded flex items-center justify-end gap-1 font-mono transition-colors duration-200",
                        direction === "up" && "price-glow-up",
                        direction === "down" && "price-glow-down",
                        direction === "neutral" && "text-slate-200 bg-transparent border-transparent"
                      )}
                    >
                      <span>{formattedPrice}</span>
                      <span
                        aria-hidden="true"
                        className={clsx(
                          "w-2.5 h-2.5 inline-flex items-center justify-center shrink-0 text-[8px] font-black leading-none transition-all duration-300",
                          direction === "up"
                            ? "text-emerald-300 opacity-100 scale-100 drop-shadow-[0_0_6px_#3fdf97]"
                            : direction === "down"
                              ? "text-rose-300 opacity-100 scale-100 drop-shadow-[0_0_6px_#eb619f]"
                              : "opacity-0 scale-50"
                        )}
                      >
                        {direction === "down" ? "▼" : "▲"}
                      </span>
                    </div>

                    <div
                      className={clsx(
                        "text-[10px] font-medium flex items-center justify-end gap-0.5 mt-0.5 px-1 py-0.2 rounded border transition-colors",
                        isPositive
                          ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
                          : "text-rose-400 bg-rose-500/10 border-rose-500/20"
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
