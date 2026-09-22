"use client";

import React, { useMemo } from "react";
import { Star } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { clsx } from "clsx";
import type { MarketSymbol } from "@gorengan/shared";
import { useMarketStore } from "../../../stores/marketStore";
import { useWatchlistStore } from "../../../stores/watchlistStore";
import { formatPrice, formatPercent, formatVolume } from "../../../utils/formatters";
import { Badge } from "../../../components/ui/badge";

interface MarketOverviewTableProps {
  symbols: MarketSymbol[];
}

export function MarketOverviewTable({ symbols }: MarketOverviewTableProps) {
  const tickers = useMarketStore((s) => s.tickers);
  const priceDirections = useMarketStore((s) => s.priceDirections);
  const selectedSymbol = useMarketStore((s) => s.selectedSymbol);
  const setSelectedSymbol = useMarketStore((s) => s.setSelectedSymbol);

  const watchlist = useWatchlistStore((s) => s.watchlist);
  const toggleWatchlist = useWatchlistStore((s) => s.toggleWatchlist);

  // Compute table rows during render (no useEffect)
  const rows = useMemo(() => {
    return symbols.map((sym) => {
      const ticker = tickers[sym.id];
      const direction = priceDirections[sym.id] || "neutral";
      const isStarred = watchlist.includes(sym.id);
      const isSelected = selectedSymbol === sym.id;

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
      };
    });
  }, [symbols, tickers, priceDirections, watchlist, selectedSymbol]);

  return (
    <div className="w-full overflow-x-auto no-scrollbar">
      <table className="w-full text-left border-collapse text-xs font-mono">
        <thead>
          <tr className="border-b border-slate-800 text-slate-500 uppercase text-[10px] tracking-wider bg-[#060910] select-none">
            <th className="py-2.5 px-3 w-10 text-center">Fav</th>
            <th className="py-2.5 px-3">Symbol</th>
            <th className="py-2.5 px-3">Type</th>
            <th className="py-2.5 px-3 text-right">Last Price</th>
            <th className="py-2.5 px-3 text-right">24h Change</th>
            <th className="py-2.5 px-3 text-center hidden md:table-cell">24h Range</th>
            <th className="py-2.5 px-3 text-right hidden sm:table-cell">24h High</th>
            <th className="py-2.5 px-3 text-right hidden sm:table-cell">24h Low</th>
            <th className="py-2.5 px-3 text-right">24h Volume</th>
            <th className="py-2.5 px-3 text-center">Source</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/40">
          <AnimatePresence initial={false}>
            {rows.map(({ symbol, ticker, direction, isStarred, isSelected, rangePercent }) => {
              const isPositive = (ticker?.changePercent24h ?? 0) >= 0;

              return (
                <motion.tr
                  key={symbol.id}
                  onClick={() => setSelectedSymbol(symbol.id)}
                  whileHover={{ backgroundColor: "rgba(30, 41, 59, 0.3)" }}
                  className={clsx(
                    "transition-colors duration-150 cursor-pointer group select-none",
                    isSelected
                      ? "bg-emerald-950/25 border-l-2 border-emerald-400"
                      : "hover:bg-slate-800/30"
                  )}
                >
                  {/* Star / Watchlist toggle */}
                  <td
                    className="py-3 px-3 text-center"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleWatchlist(symbol.id);
                    }}
                  >
                    <motion.div whileTap={{ scale: 1.4 }} className="inline-block">
                      <Star
                        className={clsx(
                          "w-3.5 h-3.5 mx-auto transition-colors",
                          isStarred
                            ? "text-yellow-400 fill-yellow-400"
                            : "text-slate-600 hover:text-slate-400"
                        )}
                      />
                    </motion.div>
                  </td>

                  {/* Symbol + Name */}
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-2">
                      <span
                        className={clsx(
                          "font-semibold text-xs sm:text-sm tracking-tight",
                          isSelected
                            ? "text-emerald-400"
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
                  <td className="py-3 px-3">
                    {symbol.isTokenizedMetal ? (
                      <Badge variant="gold" className="text-[10px] py-0 px-1.5 font-mono">
                        Tokenized Gold
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] py-0 px-1.5 font-mono">
                        {symbol.assetClass}
                      </Badge>
                    )}
                  </td>

                  {/* Price with Animated Pulse */}
                  <td className="py-3 px-3 text-right">
                    <motion.span
                      key={ticker?.price}
                      initial={{ scale: 1.05 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", stiffness: 500, damping: 25 }}
                      className={clsx(
                        "inline-block px-1.5 py-0.5 rounded font-semibold text-xs sm:text-sm tabular-nums transition-colors duration-200",
                        direction === "up" && "bg-emerald-500/15 text-emerald-400",
                        direction === "down" && "bg-rose-500/15 text-rose-400",
                        direction === "neutral" && "text-slate-100"
                      )}
                    >
                      ${formatPrice(ticker?.price)}
                    </motion.span>
                  </td>

                  {/* 24h Change % */}
                  <td className="py-3 px-3 text-right">
                    <span
                      className={clsx(
                        "inline-flex items-center justify-end font-semibold tabular-nums",
                        isPositive ? "text-emerald-400" : "text-rose-400"
                      )}
                    >
                      {formatPercent(ticker?.changePercent24h)}
                    </span>
                  </td>

                  {/* 24h Range Mini-bar */}
                  <td className="py-3 px-3 text-center hidden md:table-cell">
                    <div className="w-24 mx-auto flex flex-col gap-1">
                      <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden relative">
                        <div
                          className="h-full bg-emerald-500 transition-all duration-300 rounded-full"
                          style={{ width: `${rangePercent}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-[9px] text-slate-500 font-mono">
                        <span>L: ${formatPrice(ticker?.low24h, 0, 1)}</span>
                        <span>H: ${formatPrice(ticker?.high24h, 0, 1)}</span>
                      </div>
                    </div>
                  </td>

                  {/* 24h High */}
                  <td className="py-3 px-3 text-right text-slate-400 tabular-nums hidden sm:table-cell">
                    ${formatPrice(ticker?.high24h)}
                  </td>

                  {/* 24h Low */}
                  <td className="py-3 px-3 text-right text-slate-400 tabular-nums hidden sm:table-cell">
                    ${formatPrice(ticker?.low24h)}
                  </td>

                  {/* Volume */}
                  <td className="py-3 px-3 text-right text-slate-300 tabular-nums">
                    {formatVolume(ticker?.volume24h)} {symbol.base}
                  </td>

                  {/* Provider Source */}
                  <td className="py-3 px-3 text-center">
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider font-mono px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800">
                      {symbol.provider}
                    </span>
                  </td>
                </motion.tr>
              );
            })}
          </AnimatePresence>
        </tbody>
      </table>
    </div>
  );
}
