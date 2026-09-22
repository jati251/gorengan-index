"use client";

import React, { useMemo } from "react";
import { Star } from "lucide-react";
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

      return {
        symbol: sym,
        ticker,
        direction,
        isStarred,
        isSelected,
      };
    });
  }, [symbols, tickers, priceDirections, watchlist, selectedSymbol]);

  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full text-left border-collapse text-xs font-mono">
        <thead>
          <tr className="border-b border-slate-800 text-slate-500 uppercase text-[11px] bg-slate-900/40 select-none">
            <th className="py-2.5 px-3 w-10 text-center">Fav</th>
            <th className="py-2.5 px-3">Symbol</th>
            <th className="py-2.5 px-3">Type</th>
            <th className="py-2.5 px-3 text-right">Last Price</th>
            <th className="py-2.5 px-3 text-right">24h Change</th>
            <th className="py-2.5 px-3 text-right">24h High</th>
            <th className="py-2.5 px-3 text-right">24h Low</th>
            <th className="py-2.5 px-3 text-right">24h Volume</th>
            <th className="py-2.5 px-3 text-center">Source</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/40">
          {rows.map(({ symbol, ticker, direction, isStarred, isSelected }) => {
            const isPositive = (ticker?.changePercent24h ?? 0) >= 0;

            return (
              <tr
                key={symbol.id}
                onClick={() => setSelectedSymbol(symbol.id)}
                className={clsx(
                  "transition-colors duration-150 cursor-pointer group",
                  isSelected
                    ? "bg-emerald-950/20 hover:bg-emerald-950/30"
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
                  <Star
                    className={clsx(
                      "w-4 h-4 mx-auto transition-transform active:scale-125",
                      isStarred
                        ? "text-yellow-400 fill-yellow-400"
                        : "text-slate-600 hover:text-slate-400"
                    )}
                  />
                </td>

                {/* Symbol + Name */}
                <td className="py-3 px-3">
                  <div className="flex items-center gap-2">
                    <span
                      className={clsx(
                        "font-semibold text-sm",
                        isSelected ? "text-emerald-400" : "text-slate-100 group-hover:text-white"
                      )}
                    >
                      {symbol.id}
                    </span>
                    <span className="text-slate-400 text-xs hidden sm:inline">
                      {symbol.name}
                    </span>
                  </div>
                </td>

                {/* Asset Class */}
                <td className="py-3 px-3">
                  {symbol.isTokenizedMetal ? (
                    <Badge variant="gold" className="text-[10px] py-0 px-1.5">
                      Tokenized Gold
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] py-0 px-1.5">
                      {symbol.assetClass}
                    </Badge>
                  )}
                </td>

                {/* Price with directional flash */}
                <td className="py-3 px-3 text-right">
                  <span
                    className={clsx(
                      "inline-block px-1.5 py-0.5 rounded font-medium text-sm transition-all duration-300",
                      direction === "up" && "bg-emerald-500/20 text-emerald-400",
                      direction === "down" && "bg-rose-500/20 text-rose-400",
                      direction === "neutral" && "text-slate-100"
                    )}
                  >
                    ${formatPrice(ticker?.price)}
                  </span>
                </td>

                {/* 24h Change % */}
                <td className="py-3 px-3 text-right">
                  <span
                    className={clsx(
                      "inline-flex items-center justify-end font-semibold",
                      isPositive ? "text-emerald-400" : "text-rose-400"
                    )}
                  >
                    {formatPercent(ticker?.changePercent24h)}
                  </span>
                </td>

                {/* 24h High */}
                <td className="py-3 px-3 text-right text-slate-400">
                  ${formatPrice(ticker?.high24h)}
                </td>

                {/* 24h Low */}
                <td className="py-3 px-3 text-right text-slate-400">
                  ${formatPrice(ticker?.low24h)}
                </td>

                {/* Volume */}
                <td className="py-3 px-3 text-right text-slate-300">
                  {formatVolume(ticker?.volume24h)} {symbol.base}
                </td>

                {/* Provider Source */}
                <td className="py-3 px-3 text-center">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider font-mono">
                    {symbol.provider}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
