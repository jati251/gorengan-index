"use client";

import React from "react";
import { clsx } from "clsx";
import { useMarketStore } from "../../../stores/marketStore";
import {
  formatPrice,
  formatPercent,
  formatVolume,
  getDeviceTimezoneOffset,
} from "../../../utils/formatters";
import { TimeframeSelector } from "./TimeframeSelector";

export function ChartHeader() {
  const selectedSymbol = useMarketStore((s) => s.selectedSymbol);
  const ticker = useMarketStore((s) => s.tickers[s.selectedSymbol]);
  const direction = useMarketStore((s) => s.priceDirections[s.selectedSymbol]);

  const isPositive = (ticker?.changePercent24h ?? 0) >= 0;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-[#0a0e17] border-b border-slate-800 font-mono">
      <div className="flex flex-wrap items-center gap-4">
        {/* Symbol & Name */}
        <div className="flex items-center gap-2">
          <span className="text-base font-bold text-slate-100">
            {selectedSymbol}
          </span>
          <span className="text-xs px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
            SPOT
          </span>
        </div>

        {/* Live Price */}
        <div className="flex items-baseline gap-2">
          <span
            className={clsx(
              "text-lg font-bold transition-colors duration-300",
              direction === "up" && "text-emerald-400",
              direction === "down" && "text-rose-400",
              (!direction || direction === "neutral") && "text-slate-100"
            )}
          >
            ${formatPrice(ticker?.price)}
          </span>

          <span
            className={clsx(
              "text-xs font-semibold px-1.5 py-0.5 rounded",
              isPositive
                ? "bg-emerald-950/60 text-emerald-400 border border-emerald-800/40"
                : "bg-rose-950/60 text-rose-400 border border-rose-800/40"
            )}
          >
            {formatPercent(ticker?.changePercent24h)}
          </span>
        </div>

        {/* Stats */}
        <div className="hidden lg:flex items-center gap-4 text-xs text-slate-400 border-l border-slate-800 pl-4">
          <div>
            <span className="text-slate-500">24h High: </span>
            <span className="text-slate-200 font-medium">
              ${formatPrice(ticker?.high24h)}
            </span>
          </div>
          <div>
            <span className="text-slate-500">24h Low: </span>
            <span className="text-slate-200 font-medium">
              ${formatPrice(ticker?.low24h)}
            </span>
          </div>
          <div>
            <span className="text-slate-500">24h Vol: </span>
            <span className="text-slate-200 font-medium">
              {formatVolume(ticker?.volume24h)}
            </span>
          </div>
        </div>
      </div>

      {/* Resolution Selector & Device Timezone Pill */}
      <div className="flex items-center gap-2 sm:gap-3">
        <TimeframeSelector />
        <span
          suppressHydrationWarning
          className="hidden sm:inline-flex items-center text-[10px] text-slate-400 bg-slate-900/80 px-2 py-1 rounded border border-slate-800/80 font-mono"
        >
          {getDeviceTimezoneOffset()}
        </span>
      </div>
    </div>
  );
}
