"use client";

import React, { useMemo } from "react";
import { motion } from "framer-motion";
import { clsx } from "clsx";
import { useMarketStore } from "@/stores/marketStore";
import {
  formatPrice,
  formatPercent,
  formatVolume,
  getDeviceTimezoneOffset,
} from "@/utils/formatters";
import { formatFxPrice, formatPips, isFxSymbol, getFxMetadata } from "@/features/forex";
import { TimeframeSelector } from "./TimeframeSelector";

export function ChartHeader() {
  const selectedSymbol = useMarketStore((s) => s.selectedSymbol);
  const ticker = useMarketStore((s) => s.tickers[s.selectedSymbol]);
  const direction = useMarketStore((s) => s.priceDirections[s.selectedSymbol]);
  const selectedAssetClass = useMarketStore((s) => s.selectedAssetClass);

  const showEma20 = useMarketStore((s) => s.showEma20);
  const showEma50 = useMarketStore((s) => s.showEma50);
  const toggleEma20 = useMarketStore((s) => s.toggleEma20);
  const toggleEma50 = useMarketStore((s) => s.toggleEma50);

  const isFx = selectedAssetClass === "fx" || isFxSymbol(selectedSymbol);
  const fxMeta = useMemo(() => getFxMetadata(selectedSymbol), [selectedSymbol]);

  const isPositive = (ticker?.changePercent24h ?? 0) >= 0;

  // Format price appropriately depending on asset class
  const formattedPrice = isFx
    ? formatFxPrice(ticker?.price, selectedSymbol, fxMeta?.displayDecimals)
    : `$${formatPrice(ticker?.price)}`;

  const pipSize = fxMeta?.pipSize ?? 0.0001;
  const spreadDisplay = ticker?.spreadPips != null
    ? `${ticker.spreadPips} pip`
    : formatPips(ticker?.spread, pipSize);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 bg-[#080c16] border-b border-slate-800/90 font-mono select-none">
      <div className="flex flex-wrap items-center gap-4">
        {/* Symbol badge & provenance */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          <span className="text-base font-bold text-slate-100 tracking-tight">
            {selectedSymbol}
          </span>

          {isFx ? (
            <>
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-950/70 text-blue-400 border border-blue-800/50">
                FOREX
              </span>
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-800/80 text-cyan-400 border border-slate-700/50">
                MID
              </span>
              <span className="hidden sm:inline-flex text-[9px] font-medium px-1.5 py-0.5 rounded bg-slate-900 text-slate-400 border border-slate-800">
                {fxMeta?.venueLabel ?? ticker?.provider ?? "Interbank"}
              </span>
            </>
          ) : (
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-800/80 text-emerald-400 border border-slate-700/50">
              SPOT
            </span>
          )}
        </div>

        {/* Animated Live Price */}
        <div className="flex items-baseline gap-2.5">
          <motion.span
            key={ticker?.price}
            initial={{ scale: 1.04 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 500, damping: 25 }}
            className={clsx(
              "text-xl font-bold tabular-nums tracking-tight transition-colors duration-200",
              direction === "up" && "text-emerald-400 drop-shadow-[0_0_8px_rgba(16,185,129,0.35)]",
              direction === "down" && "text-rose-400 drop-shadow-[0_0_8px_rgba(244,63,94,0.35)]",
              (!direction || direction === "neutral") && "text-slate-100"
            )}
          >
            {formattedPrice}
          </motion.span>

          <span
            className={clsx(
              "text-xs font-semibold px-2 py-0.5 rounded border transition-colors",
              isPositive
                ? "bg-emerald-950/60 text-emerald-400 border-emerald-800/40"
                : "bg-rose-950/60 text-rose-400 border-rose-800/40"
            )}
          >
            {formatPercent(ticker?.changePercent24h)}
          </span>
        </div>

        {/* Dynamic Asset-Specific Stats Header */}
        {isFx ? (
          <div className="hidden xl:flex items-center gap-4 text-xs text-slate-400 border-l border-slate-800/80 pl-4">
            <div>
              <span className="text-slate-500">BID: </span>
              <span className="text-slate-200 font-medium tabular-nums">
                {formatFxPrice(ticker?.bid, selectedSymbol, fxMeta?.displayDecimals)}
              </span>
            </div>
            <div>
              <span className="text-slate-500">ASK: </span>
              <span className="text-slate-200 font-medium tabular-nums">
                {formatFxPrice(ticker?.ask, selectedSymbol, fxMeta?.displayDecimals)}
              </span>
            </div>
            <div>
              <span className="text-slate-500">SPREAD: </span>
              <span className="text-amber-400 font-semibold tabular-nums">
                {spreadDisplay}
              </span>
            </div>
            <div className="flex items-center gap-1.5 pl-1">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[10px] text-emerald-400 uppercase font-bold tracking-wider">
                {ticker?.sessionState ?? "LIVE"}
              </span>
            </div>
          </div>
        ) : (
          <div className="hidden xl:flex items-center gap-4 text-xs text-slate-400 border-l border-slate-800/80 pl-4">
            <div>
              <span className="text-slate-500">24h High: </span>
              <span className="text-slate-200 font-medium tabular-nums">
                ${formatPrice(ticker?.high24h)}
              </span>
            </div>
            <div>
              <span className="text-slate-500">24h Low: </span>
              <span className="text-slate-200 font-medium tabular-nums">
                ${formatPrice(ticker?.low24h)}
              </span>
            </div>
            <div>
              <span className="text-slate-500">24h Vol: </span>
              <span className="text-slate-200 font-medium tabular-nums">
                {formatVolume(ticker?.volume24h)}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Controls: Indicators + Resolution Selector + Timezone Pill */}
      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        {/* Indicator Toggles */}
        <div className="flex items-center gap-1 bg-[#060910] p-1 rounded-md border border-slate-800/80 text-[11px]">
          <button
            onClick={toggleEma20}
            className={clsx(
              "px-2 py-0.5 rounded transition-all cursor-pointer font-medium",
              showEma20
                ? "bg-[#06b6d4]/20 text-[#06b6d4] border border-[#06b6d4]/40 font-bold"
                : "text-slate-500 hover:text-slate-300"
            )}
          >
            EMA 20
          </button>
          <button
            onClick={toggleEma50}
            className={clsx(
              "px-2 py-0.5 rounded transition-all cursor-pointer font-medium",
              showEma50
                ? "bg-[#f59e0b]/20 text-[#f59e0b] border border-[#f59e0b]/40 font-bold"
                : "text-slate-500 hover:text-slate-300"
            )}
          >
            EMA 50
          </button>
        </div>

        {/* Timeframe Selector */}
        <TimeframeSelector />

        {/* Local Device Timezone Pill */}
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
