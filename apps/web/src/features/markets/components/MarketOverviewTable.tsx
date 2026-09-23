"use client";

import React, { useMemo, useState, useRef, useEffect, useCallback } from "react";
import {
  Star,
  TrendingUp,
  TrendingDown,
  Search,
  X,
  ArrowRight,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  SearchX,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { clsx } from "clsx";
import type { MarketSymbol } from "@gorengan/shared";
import { useMarketStore, type MarketCategory } from "@/stores/marketStore";
import { useWatchlistStore } from "@/stores/watchlistStore";
import { formatPrice, formatPercent, formatVolume } from "@/utils/formatters";
import { formatFxPrice, isFxSymbol } from "@/features/forex";
import {
  formatEquityPrice,
  getSessionBadgeInfo,
  isEquitySymbol,
  isUsEquitySymbol,
  isIdxEquitySymbol,
} from "@/features/equities";
import { Badge } from "@/components/ui/badge";

interface MarketOverviewTableProps {
  symbols: MarketSymbol[];
  onSelectSymbol?: (symbolId: string) => void;
}

const CATEGORIES: { id: MarketCategory; label: string }[] = [
  { id: "all", label: "All" },
  { id: "crypto", label: "Crypto" },
  { id: "fx", label: "Forex" },
  { id: "us_stocks", label: "US Stocks" },
  { id: "idx_stocks", label: "IDX Stocks" },
];

export type SortColumn = "symbol" | "price" | "change" | "range" | "high" | "low" | "volume";
export type SortDirection = "asc" | "desc";

export function MarketOverviewTable({ symbols, onSelectSymbol }: MarketOverviewTableProps) {
  const tickers = useMarketStore((s) => s.tickers);
  const priceDirections = useMarketStore((s) => s.priceDirections);
  const selectedSymbol = useMarketStore((s) => s.selectedSymbol);
  const setSelectedSymbol = useMarketStore((s) => s.setSelectedSymbol);
  const selectedCategory = useMarketStore((s) => s.selectedCategory);
  const setSelectedCategory = useMarketStore((s) => s.setSelectedCategory);

  const watchlist = useWatchlistStore((s) => s.watchlist);
  const toggleWatchlist = useWatchlistStore((s) => s.toggleWatchlist);

  // Search & Suggestion Dropdown state
  const [searchQuery, setSearchQuery] = useState("");
  const [committedSearch, setCommittedSearch] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Sorting state
  const [sortColumn, setSortColumn] = useState<SortColumn | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  // Pagination (25 items per page / load)
  const [visibleCount, setVisibleCount] = useState(25);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Handle column header click for sorting
  const handleSort = (col: SortColumn) => {
    if (sortColumn === col) {
      if (sortDirection === "desc") {
        setSortDirection("asc");
      } else {
        // Toggle back to unsorted default
        setSortColumn(null);
        setSortDirection("desc");
      }
    } else {
      setSortColumn(col);
      // Alphabetical defaults to asc, numerical metrics default to desc
      setSortDirection(col === "symbol" ? "asc" : "desc");
    }
    setVisibleCount(25);
  };



  // Click outside to close suggestion dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Compute suggestions across all symbols
  const suggestions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return symbols
      .filter(
        (s) =>
          s.id.toLowerCase().includes(q) ||
          s.name.toLowerCase().includes(q) ||
          s.base.toLowerCase().includes(q)
      )
      .slice(0, 7);
  }, [symbols, searchQuery]);

  // Filter symbols based on selectedCategory
  const categoryFilteredSymbols = useMemo(() => {
    return symbols.filter((sym) => {
      if (selectedCategory === "all") return true;
      if (selectedCategory === "us_stocks") {
        return sym.assetClass === "us_stocks" || isUsEquitySymbol(sym.id);
      }
      if (selectedCategory === "idx_stocks") {
        return sym.assetClass === "idx_stocks" || isIdxEquitySymbol(sym.id);
      }
      if (selectedCategory === "fx") {
        return sym.assetClass === "fx" || isFxSymbol(sym.id);
      }
      return sym.assetClass === "crypto" || (!isFxSymbol(sym.id) && !isEquitySymbol(sym.id));
    });
  }, [symbols, selectedCategory]);

  // Search filter applied to category symbols ONLY when committed via Enter or Dropdown select
  const displaySymbols = useMemo(() => {
    const q = committedSearch.trim().toLowerCase();
    if (!q) return categoryFilteredSymbols;
    return categoryFilteredSymbols.filter(
      (sym) =>
        sym.id.toLowerCase().includes(q) ||
        sym.name.toLowerCase().includes(q) ||
        sym.base.toLowerCase().includes(q)
    );
  }, [categoryFilteredSymbols, committedSearch]);

  // Compute table rows during render (no useEffect)
  const rows = useMemo(() => {
    return displaySymbols.map((sym) => {
      const ticker = tickers[sym.id];
      const direction = priceDirections[sym.id] || "neutral";
      const isStarred = watchlist.includes(sym.id);
      const isSelected = selectedSymbol === sym.id;
      const isUs = sym.assetClass === "us_stocks" || isUsEquitySymbol(sym.id);
      const isId = sym.assetClass === "idx_stocks" || isIdxEquitySymbol(sym.id);
      const isFx = !isUs && !isId && (sym.assetClass === "fx" || isFxSymbol(sym.id));

      const price = ticker?.price ?? 0;
      const high = ticker?.high24h ?? price;
      const low = ticker?.low24h ?? price;
      const rangePercent =
        high > low ? Math.min(100, Math.max(0, ((price - low) / (high - low)) * 100)) : 50;

      return {
        symbol: sym,
        ticker,
        direction,
        isStarred,
        isSelected,
        rangePercent,
        isFx,
        isUs,
        isId,
      };
    });
  }, [displaySymbols, tickers, priceDirections, watchlist, selectedSymbol]);

  // Sort rows based on sortColumn and sortDirection
  const sortedRows = useMemo(() => {
    if (!sortColumn) return rows;
    return [...rows].sort((a, b) => {
      let diff = 0;
      switch (sortColumn) {
        case "symbol":
          diff = a.symbol.id.localeCompare(b.symbol.id);
          break;
        case "price":
          diff = (a.ticker?.price ?? 0) - (b.ticker?.price ?? 0);
          break;
        case "change":
          diff = (a.ticker?.changePercent24h ?? 0) - (b.ticker?.changePercent24h ?? 0);
          break;
        case "range":
          diff = a.rangePercent - b.rangePercent;
          break;
        case "high":
          diff = (a.ticker?.high24h ?? 0) - (b.ticker?.high24h ?? 0);
          break;
        case "low":
          diff = (a.ticker?.low24h ?? 0) - (b.ticker?.low24h ?? 0);
          break;
        case "volume":
          diff = (a.ticker?.volume24h ?? 0) - (b.ticker?.volume24h ?? 0);
          break;
      }
      return sortDirection === "asc" ? diff : -diff;
    });
  }, [rows, sortColumn, sortDirection]);

  // Slice sorted rows for 25-item infinite scrolling
  const visibleRows = useMemo(() => {
    return sortedRows.slice(0, visibleCount);
  }, [sortedRows, visibleCount]);

  const hasMore = visibleCount < sortedRows.length;

  // Infinite scroll trigger via IntersectionObserver
  const loadMore = useCallback(() => {
    setVisibleCount((prev) => Math.min(prev + 25, sortedRows.length));
  }, [sortedRows.length]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore) {
          loadMore();
        }
      },
      { root: scrollContainerRef.current, rootMargin: "150px" }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loadMore]);

  // Fallback scroll listener
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 180 && hasMore) {
      loadMore();
    }
  };

  // Select suggestion handler
  const handleSelectSuggestion = (sym: MarketSymbol) => {
    setSelectedSymbol(sym.id);
    onSelectSymbol?.(sym.id);
    setIsDropdownOpen(false);
    setSearchQuery(sym.id);
    setCommittedSearch(sym.id);
    setVisibleCount(25);
  };

  // Keyboard navigation for suggestions and Enter to commit search
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (isDropdownOpen && activeSuggestionIndex >= 0 && activeSuggestionIndex < suggestions.length) {
        handleSelectSuggestion(suggestions[activeSuggestionIndex]);
      } else {
        setCommittedSearch(searchQuery.trim());
        setIsDropdownOpen(false);
        setVisibleCount(25);
      }
      return;
    }

    if (!isDropdownOpen || suggestions.length === 0) {
      if (e.key === "ArrowDown" && suggestions.length > 0) {
        setIsDropdownOpen(true);
        setActiveSuggestionIndex(0);
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveSuggestionIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveSuggestionIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
    } else if (e.key === "Escape") {
      setIsDropdownOpen(false);
    }
  };

  // Helper to render sort indicator icons on column headers
  const renderSortIcon = (col: SortColumn) => {
    if (sortColumn === col) {
      return sortDirection === "asc" ? (
        <ArrowUp className="w-3 h-3 text-emerald-400 shrink-0 inline ml-1" />
      ) : (
        <ArrowDown className="w-3 h-3 text-emerald-400 shrink-0 inline ml-1" />
      );
    }
    return (
      <ArrowUpDown className="w-3 h-3 text-slate-500 opacity-40 group-hover/th:opacity-100 shrink-0 inline ml-1 transition-opacity" />
    );
  };

  return (
    <div className="flex flex-col w-full bg-[#2a2839]/60 rounded-xl overflow-hidden border border-white/[0.06]">
      {/* ─── Control Bar: Categories & Search Bar with Suggestion Dropdown ─── */}
      <div className="p-3 bg-[#3c3f5f]/70 border-b border-[#55607e]/60 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Category Pills */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
          {CATEGORIES.map((cat) => {
            const isActive = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => {
                  setSelectedCategory(cat.id);
                  setVisibleCount(25);
                }}
                className={clsx(
                  "px-2.5 py-1 rounded-md text-[11px] font-mono whitespace-nowrap transition-all duration-150 cursor-pointer border",
                  isActive
                    ? "bg-emerald-500/20 border-emerald-500/60 text-emerald-300 font-bold shadow-[0_0_10px_rgba(63,223,151,0.2)]"
                    : "bg-white/[0.03] hover:bg-white/[0.08] border-white/[0.06] text-slate-300 hover:text-white"
                )}
              >
                {cat.label}
              </button>
            );
          })}
        </div>

        {/* Search with Suggestion Dropdown */}
        <div ref={searchContainerRef} className="relative flex-1 md:max-w-[320px]">
          <div className="relative flex items-center">
            <Search className="w-3.5 h-3.5 absolute left-2.5 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder={`Search ${symbols.length} markets...`}
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setIsDropdownOpen(true);
                setActiveSuggestionIndex(-1);
                setVisibleCount(25);
              }}
              onFocus={() => {
                if (searchQuery.trim().length > 0) setIsDropdownOpen(true);
              }}
              onKeyDown={handleKeyDown}
              className="w-full bg-[#2a2839] border border-white/[0.1] focus:border-emerald-500/60 rounded-lg py-1.5 pl-8 pr-7 text-xs text-slate-100 placeholder-slate-400 focus:outline-hidden font-mono transition-all focus:ring-1 focus:ring-emerald-500/30"
            />
            {searchQuery && (
              <div className="absolute right-2 flex items-center gap-1.5">
                <span className="hidden sm:inline-flex items-center text-[9px] font-mono text-emerald-400/80 bg-emerald-500/10 border border-emerald-500/25 px-1 rounded">
                  ↵ Enter
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery("");
                    setCommittedSearch("");
                    setIsDropdownOpen(false);
                    setVisibleCount(25);
                  }}
                  className="text-slate-400 hover:text-white transition-colors cursor-pointer"
                  title="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* Suggestion Dropdown List with Framer Motion */}
          <AnimatePresence>
            {isDropdownOpen && searchQuery.trim().length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -6, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.98 }}
                transition={{ duration: 0.16, ease: "easeOut" }}
                className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-[#2a2839] border border-white/[0.14] rounded-lg shadow-2xl backdrop-blur-xl overflow-hidden font-mono"
              >
                <div className="px-3 py-1.5 bg-[#3c3f5f]/80 border-b border-white/[0.08] text-[9.5px] uppercase tracking-wider text-slate-400 font-semibold flex items-center justify-between">
                  <span>Matching Markets</span>
                  <span>{suggestions.length} results</span>
                </div>

                {suggestions.length === 0 ? (
                  <div className="p-3 text-center text-xs text-slate-400 italic">
                    No matching symbol for &ldquo;{searchQuery}&rdquo; · Press Enter to search
                  </div>
                ) : (
                  <div className="max-h-[260px] overflow-y-auto divide-y divide-white/[0.04]">
                    {suggestions.map((sym, idx) => {
                      const isHighlighted = idx === activeSuggestionIndex;
                      const ticker = tickers[sym.id];
                      const isPositive = (ticker?.changePercent24h ?? 0) >= 0;
                      const isUs = sym.assetClass === "us_stocks" || isUsEquitySymbol(sym.id);
                      const isId = sym.assetClass === "idx_stocks" || isIdxEquitySymbol(sym.id);
                      const isFx = !isUs && !isId && (sym.assetClass === "fx" || isFxSymbol(sym.id));

                      let priceText = `$${formatPrice(ticker?.price)}`;
                      if (isFx) {
                        priceText = formatFxPrice(ticker?.price, sym.id, sym.displayDecimals);
                      } else if (isId) {
                        priceText = formatEquityPrice(ticker?.price, sym.id, "IDR");
                      } else if (isUs) {
                        priceText = formatEquityPrice(ticker?.price, sym.id, "USD");
                      }

                      return (
                        <button
                          key={sym.id}
                          type="button"
                          onClick={() => handleSelectSuggestion(sym)}
                          onMouseEnter={() => setActiveSuggestionIndex(idx)}
                          className={clsx(
                            "w-full text-left px-3 py-2 flex items-center justify-between gap-2 transition-colors cursor-pointer",
                            isHighlighted ? "bg-white/[0.08] text-white" : "hover:bg-white/[0.04] text-slate-200"
                          )}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="font-bold text-xs text-emerald-300 shrink-0">
                              {sym.id}
                            </span>
                            <span className="text-[11px] text-slate-400 truncate">
                              {sym.name}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-xs font-semibold tabular-nums text-slate-100">
                              {priceText}
                            </span>
                            <span
                              className={clsx(
                                "text-[10px] px-1.5 py-0.2 rounded font-semibold tabular-nums",
                                isPositive ? "bg-emerald-500/20 text-emerald-400" : "bg-rose-500/20 text-rose-400"
                              )}
                            >
                              {formatPercent(ticker?.changePercent24h)}
                            </span>
                            <ArrowRight className="w-3 h-3 text-slate-500" />
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
      </div>

      {/* ─── Scrollable Table with Sortable Columns & 25-item Infinite Pagination ─── */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="terminal-table-scroll w-full max-h-[460px] overflow-auto relative"
      >
        <table className="w-full text-left border-collapse text-xs font-mono">
          <thead className="sticky top-0 z-10 bg-[#3c3f5f] border-b border-[#757e8a]">
            <tr className="text-slate-400 uppercase text-[9.5px] tracking-wider select-none">
              <th className="py-2.5 px-3 w-10 text-center">Fav</th>
              <th
                onClick={() => handleSort("symbol")}
                className="py-2.5 px-3 cursor-pointer group/th hover:text-white transition-colors"
                title="Sort by Symbol"
              >
                Symbol {renderSortIcon("symbol")}
              </th>
              <th className="py-2.5 px-3 hidden md:table-cell">Type</th>
              <th
                onClick={() => handleSort("price")}
                className="py-2.5 px-3 text-right cursor-pointer group/th hover:text-white transition-colors"
                title="Sort by Last Price"
              >
                Last Price {renderSortIcon("price")}
              </th>
              <th
                onClick={() => handleSort("change")}
                className="py-2.5 px-3 text-right cursor-pointer group/th hover:text-white transition-colors"
                title="Sort by 24h Change %"
              >
                24h Change {renderSortIcon("change")}
              </th>
              <th
                onClick={() => handleSort("range")}
                className="py-2.5 px-3 text-center hidden md:table-cell cursor-pointer group/th hover:text-white transition-colors"
                title="Sort by 24h Range"
              >
                24h Range {renderSortIcon("range")}
              </th>
              <th
                onClick={() => handleSort("high")}
                className="py-2.5 px-3 text-right hidden lg:table-cell cursor-pointer group/th hover:text-white transition-colors"
                title="Sort by 24h High"
              >
                24h High {renderSortIcon("high")}
              </th>
              <th
                onClick={() => handleSort("low")}
                className="py-2.5 px-3 text-right hidden lg:table-cell cursor-pointer group/th hover:text-white transition-colors"
                title="Sort by 24h Low"
              >
                24h Low {renderSortIcon("low")}
              </th>
              <th
                onClick={() => handleSort("volume")}
                className="py-2.5 px-3 text-right hidden md:table-cell cursor-pointer group/th hover:text-white transition-colors"
                title="Sort by 24h Volume / Spread"
              >
                {selectedCategory === "fx" ? "Spread (Pips)" : "24h Volume"} {renderSortIcon("volume")}
              </th>
              <th className="py-2.5 px-3 text-center hidden md:table-cell">Source</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {visibleRows.length === 0 ? (
              <tr>
                <td colSpan={10} className="py-14 px-4 text-center">
                  <div className="flex flex-col items-center justify-center gap-2 font-mono text-slate-400">
                    <SearchX className="w-8 h-8 text-slate-500 mb-1" />
                    <span className="text-sm font-semibold text-slate-200">
                      No matching markets found
                    </span>
                    <p className="text-xs text-slate-500 max-w-sm">
                      {committedSearch
                        ? `No assets match "${committedSearch}" in the ${selectedCategory.toUpperCase()} category.`
                        : "No assets match your current category and search filter."}
                    </p>
                    {committedSearch && (
                      <button
                        type="button"
                        onClick={() => {
                          setSearchQuery("");
                          setCommittedSearch("");
                          setVisibleCount(25);
                        }}
                        className="mt-2 text-xs px-3 py-1.5 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 font-bold transition-colors cursor-pointer"
                      >
                        Clear Search Filter
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              visibleRows.map(({ symbol, ticker, direction, isStarred, isSelected, rangePercent, isFx, isUs, isId }) => {
                const isPositive = (ticker?.changePercent24h ?? 0) >= 0;

                let formattedPrice = `$${formatPrice(ticker?.price)}`;
                let highFormatted = `$${formatPrice(ticker?.high24h)}`;
                let lowFormatted = `$${formatPrice(ticker?.low24h)}`;

                if (isFx) {
                  formattedPrice = formatFxPrice(ticker?.price, symbol.id, symbol.displayDecimals);
                  highFormatted = formatFxPrice(ticker?.high24h, symbol.id, symbol.displayDecimals);
                  lowFormatted = formatFxPrice(ticker?.low24h, symbol.id, symbol.displayDecimals);
                } else if (isId) {
                  formattedPrice = formatEquityPrice(ticker?.price, symbol.id, "IDR");
                  highFormatted = formatEquityPrice(ticker?.high24h, symbol.id, "IDR");
                  lowFormatted = formatEquityPrice(ticker?.low24h, symbol.id, "IDR");
                } else if (isUs) {
                  formattedPrice = formatEquityPrice(ticker?.price, symbol.id, "USD");
                  highFormatted = formatEquityPrice(ticker?.high24h, symbol.id, "USD");
                  lowFormatted = formatEquityPrice(ticker?.low24h, symbol.id, "USD");
                }

                const badgeInfo = isUs || isId
                  ? getSessionBadgeInfo(ticker?.sessionState, ticker?.dataQuality, isUs)
                  : null;

                return (
                  <tr
                    key={symbol.id}
                    tabIndex={0}
                    aria-label={`Show ${symbol.name} chart`}
                    onClick={() => {
                      setSelectedSymbol(symbol.id);
                      onSelectSymbol?.(symbol.id);
                    }}
                    onKeyDown={(event) => {
                      if (event.target !== event.currentTarget) return;
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setSelectedSymbol(symbol.id);
                        onSelectSymbol?.(symbol.id);
                      }
                    }}
                    className={clsx(
                      "transition-all duration-150 cursor-pointer group select-none",
                      isSelected
                        ? isUs
                          ? "bg-cyan-500/[0.12] border-l-2 border-cyan-400 shadow-[inset_0_0_12px_rgba(38,166,172,0.12)]"
                          : isId
                            ? "bg-amber-500/[0.12] border-l-2 border-amber-400 shadow-[inset_0_0_12px_rgba(244,196,27,0.12)]"
                            : isFx
                              ? "bg-blue-500/[0.12] border-l-2 border-blue-400 shadow-[inset_0_0_12px_rgba(57,120,168,0.12)]"
                              : "bg-emerald-500/[0.12] border-l-2 border-emerald-400 shadow-[inset_0_0_12px_rgba(63,223,151,0.12)]"
                        : isPositive
                          ? "hover:bg-emerald-500/[0.04] border-l-2 border-transparent hover:border-emerald-500/50"
                          : "hover:bg-rose-500/[0.04] border-l-2 border-transparent hover:border-rose-500/50"
                    )}
                  >
                    {/* Star / Watchlist toggle */}
                    <td className="py-3 px-3 text-center">
                      <button
                        type="button"
                        aria-label={`${isStarred ? "Remove" : "Add"} ${symbol.id} ${isStarred ? "from" : "to"} watchlist`}
                        aria-pressed={isStarred}
                        onClick={(event) => {
                          event.stopPropagation();
                          toggleWatchlist(symbol.id);
                        }}
                        className="inline-flex min-h-8 min-w-8 items-center justify-center cursor-pointer"
                      >
                        <Star
                          className={clsx(
                            "w-3.5 h-3.5 mx-auto transition-colors",
                            isStarred
                              ? "text-yellow-400 fill-yellow-400"
                              : "text-slate-600 hover:text-slate-400"
                          )}
                        />
                      </button>
                    </td>

                    {/* Symbol + Name */}
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2">
                        <span
                          className={clsx(
                            "font-semibold text-xs sm:text-sm tracking-tight",
                            isSelected
                              ? isUs
                                ? "text-cyan-400"
                                : isId
                                  ? "text-amber-400"
                                  : isFx
                                    ? "text-blue-400"
                                    : "text-emerald-400"
                              : "text-slate-100 group-hover:text-white"
                          )}
                        >
                          {symbol.id}
                        </span>
                        <span className="text-slate-500 text-xs hidden lg:inline">
                          {symbol.name}
                        </span>
                      </div>
                    </td>

                    {/* Asset Class Badge */}
                    <td className="py-3 px-3 hidden md:table-cell">
                      {symbol.isTokenizedMetal ? (
                        <Badge variant="gold" className="text-[10px] py-0 px-1.5 font-mono">
                          Tokenized Gold
                        </Badge>
                      ) : isUs ? (
                        <Badge variant="outline" className="text-[10px] py-0 px-1.5 font-mono text-cyan-400 border-cyan-800/50 bg-cyan-950/40">
                          US EQUITIES
                        </Badge>
                      ) : isId ? (
                        <Badge variant="outline" className="text-[10px] py-0 px-1.5 font-mono text-amber-400 border-amber-800/50 bg-amber-950/40">
                          IDX EQUITIES
                        </Badge>
                      ) : isFx ? (
                        <Badge variant="outline" className="text-[10px] py-0 px-1.5 font-mono text-blue-400 border-blue-800/50 bg-blue-950/40">
                          FOREX
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] py-0 px-1.5 font-mono text-emerald-400 border-emerald-800/50 bg-emerald-950/40">
                          CRYPTO
                        </Badge>
                      )}
                    </td>

                    {/* Price with Animated Glow/Flash */}
                    <td className="py-3 px-3 text-right">
                      <span
                        data-direction={direction}
                        className={clsx(
                          "inline-flex items-center justify-end gap-1 px-2 py-0.5 font-semibold text-xs sm:text-sm tabular-nums border rounded transition-colors duration-200",
                          direction === "up" && "price-glow-up",
                          direction === "down" && "price-glow-down",
                          direction === "neutral" && "text-slate-100 bg-white/[0.02] border-transparent"
                        )}
                      >
                        <span>{formattedPrice}</span>
                        <span
                          aria-hidden="true"
                          className={clsx(
                            "w-2.5 h-2.5 inline-flex items-center justify-center shrink-0 text-[9px] font-black leading-none transition-all duration-300",
                            direction === "up"
                              ? "text-emerald-300 opacity-100 scale-100 drop-shadow-[0_0_6px_#3fdf97]"
                              : direction === "down"
                                ? "text-rose-300 opacity-100 scale-100 drop-shadow-[0_0_6px_#eb619f]"
                                : "opacity-0 scale-50"
                          )}
                        >
                          {direction === "down" ? "▼" : "▲"}
                        </span>
                      </span>
                    </td>

                    {/* 24h Change % */}
                    <td className="py-3 px-3 text-right">
                      <span
                        className={clsx(
                          "inline-flex items-center justify-end gap-1 px-2 py-0.5 rounded-md font-semibold tabular-nums text-xs border transition-all",
                          isPositive
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/25"
                            : "bg-rose-500/10 text-rose-400 border-rose-500/25"
                        )}
                      >
                        {isPositive ? (
                          <TrendingUp className="w-3 h-3 text-emerald-400" />
                        ) : (
                          <TrendingDown className="w-3 h-3 text-rose-400" />
                        )}
                        <span>{formatPercent(ticker?.changePercent24h)}</span>
                      </span>
                    </td>

                    {/* 24h Range Mini-bar */}
                    <td className="py-3 px-3 text-center hidden md:table-cell">
                      <div className="w-24 mx-auto flex flex-col gap-1">
                        <div className="w-full bg-slate-800/90 h-1.5 rounded-full overflow-hidden relative shadow-inner">
                          <div
                            className={clsx(
                              "h-full transition-all duration-300 rounded-full",
                              isPositive
                                ? "bg-gradient-to-r from-emerald-500 to-emerald-400 shadow-[0_0_8px_rgba(63,223,151,0.4)]"
                                : "bg-gradient-to-r from-rose-500 to-rose-400 shadow-[0_0_8px_rgba(235,97,159,0.4)]"
                            )}
                            style={{ width: `${rangePercent}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-[9px] text-slate-500 font-mono">
                          <span>L: {lowFormatted}</span>
                          <span>H: {highFormatted}</span>
                        </div>
                      </div>
                    </td>

                    {/* 24h High */}
                    <td className="py-3 px-3 text-right text-slate-400 tabular-nums hidden lg:table-cell">
                      {highFormatted}
                    </td>

                    {/* 24h Low */}
                    <td className="py-3 px-3 text-right text-slate-400 tabular-nums hidden lg:table-cell">
                      {lowFormatted}
                    </td>

                    {/* Volume / Spread for FX */}
                    <td className="py-3 px-3 text-right text-slate-300 tabular-nums hidden md:table-cell">
                      {isFx ? (
                        <span className="text-amber-400 font-semibold">
                          {ticker?.spreadPips ? `${ticker.spreadPips} pip` : "0.8 pip"}
                        </span>
                      ) : isUs || isId ? (
                        `${formatVolume(ticker?.volume24h)} vol`
                      ) : (
                        `${formatVolume(ticker?.volume24h)} ${symbol.base}`
                      )}
                    </td>

                    {/* Provider Source & Session Badge */}
                    <td className="py-3 px-3 text-center hidden md:table-cell">
                      {badgeInfo ? (
                        <span className={clsx("text-[10px] uppercase tracking-wider font-mono px-1.5 py-0.5 rounded border font-bold", badgeInfo.colorClass)}>
                          {badgeInfo.label}
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-400 uppercase tracking-wider font-mono px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800">
                          {symbol.provider}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        {/* ─── Infinite Scrolling Sentinel & Counter Status ─── */}
        <div ref={sentinelRef} className="py-3 px-4 bg-[#2a2839]/80 border-t border-white/[0.04] flex items-center justify-between text-[11px] font-mono text-slate-400">
          <span>
            Showing <strong className="text-emerald-400">{Math.min(visibleCount, sortedRows.length)}</strong> of <strong className="text-white">{sortedRows.length}</strong> markets
            {sortColumn && (
              <span className="text-slate-400 ml-2">
                (sorted by <span className="text-emerald-300 uppercase">{sortColumn}</span> {sortDirection.toUpperCase()})
              </span>
            )}
          </span>
          {hasMore ? (
            <button
              type="button"
              onClick={loadMore}
              className="text-xs text-emerald-400 hover:text-emerald-300 font-bold underline underline-offset-2 transition-colors cursor-pointer"
            >
              Scroll down or click to load +25 more
            </button>
          ) : (
            <span className="text-slate-500">All markets loaded</span>
          )}
        </div>
      </div>
    </div>
  );
}
