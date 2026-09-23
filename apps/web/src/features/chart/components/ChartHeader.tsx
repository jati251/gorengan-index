"use client";

import React, { useMemo } from "react";
import { TrendingUp, TrendingDown } from "lucide-react";
import { clsx } from "clsx";
import { useMarketStore } from "@/stores/marketStore";
import {
  formatPrice,
  formatPercent,
  formatVolume,
  getDeviceTimezoneOffset,
} from "@/utils/formatters";
import { formatFxPrice, formatPips, isFxSymbol, getFxMetadata } from "@/features/forex";
import {
  formatEquityPrice,
  formatEquityVolume,
  getSessionBadgeInfo,
  isUsEquitySymbol,
  isIdxEquitySymbol,
  getEquityMetadata,
} from "@/features/equities";
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

  const isUs = selectedAssetClass === "us_stocks" || isUsEquitySymbol(selectedSymbol);
  const isId = selectedAssetClass === "idx_stocks" || isIdxEquitySymbol(selectedSymbol);
  const isEquity = isUs || isId;
  const isFx = !isEquity && (selectedAssetClass === "fx" || isFxSymbol(selectedSymbol));

  const fxMeta = useMemo(() => (isFx ? getFxMetadata(selectedSymbol) : undefined), [selectedSymbol, isFx]);
  const eqMeta = useMemo(() => (isEquity ? getEquityMetadata(selectedSymbol) : undefined), [selectedSymbol, isEquity]);

  const isPositive = (ticker?.changePercent24h ?? 0) >= 0;

  // Format price appropriately depending on asset class
  let formattedPrice = `$${formatPrice(ticker?.price)}`;
  if (isFx) {
    formattedPrice = formatFxPrice(ticker?.price, selectedSymbol, fxMeta?.displayDecimals);
  } else if (isId) {
    formattedPrice = formatEquityPrice(ticker?.price, selectedSymbol, "IDR");
  } else if (isUs) {
    formattedPrice = formatEquityPrice(ticker?.price, selectedSymbol, "USD");
  }

  const pipSize = fxMeta?.pipSize ?? 0.0001;
  const spreadDisplay = ticker?.spreadPips != null
    ? `${ticker.spreadPips} pip`
    : formatPips(ticker?.spread, pipSize);

  const equityBadgeInfo = isEquity
    ? getSessionBadgeInfo(ticker?.sessionState, ticker?.dataQuality, isUs)
    : null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 bg-[#3c3f5f] border-b border-[#55607e] font-mono select-none">
      <div className="flex flex-wrap items-center gap-4">
        {/* Symbol badge & provenance */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          <span className="text-base font-bold text-slate-100 tracking-tight">
            {selectedSymbol}
          </span>

          {isUs ? (
            <>
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-cyan-950/70 text-cyan-400 border border-cyan-800/50">
                US
              </span>
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-800/80 text-cyan-300 border border-slate-700/50">
                {eqMeta?.exchange ?? "NASDAQ"}
              </span>
              {equityBadgeInfo && (
                <span className={clsx("text-[9px] font-bold px-1.5 py-0.5 rounded border tracking-wider", equityBadgeInfo.colorClass)}>
                  {equityBadgeInfo.label}
                </span>
              )}
            </>
          ) : isId ? (
            <>
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-950/70 text-amber-400 border border-amber-800/50">
                IDX
              </span>
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-800/80 text-amber-300 border border-slate-700/50">
                JAKARTA
              </span>
              {equityBadgeInfo && (
                <span className={clsx("text-[9px] font-bold px-1.5 py-0.5 rounded border tracking-wider", equityBadgeInfo.colorClass)}>
                  {equityBadgeInfo.label}
                </span>
              )}
            </>
          ) : isFx ? (
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
        <div className="flex items-center gap-2.5">
          <div
            data-direction={direction || "neutral"}
            className={clsx(
              "flex items-center gap-1.5 px-3 py-1 rounded-lg border font-mono transition-all duration-300",
              direction === "up" && "cyber-glow-up",
              direction === "down" && "cyber-glow-down",
              (!direction || direction === "neutral") &&
                "bg-white/[0.03] border-white/[0.08] text-slate-100"
            )}
          >
            <span
              className={clsx(
                "text-xl sm:text-2xl font-bold tabular-nums tracking-tight transition-colors duration-200",
                direction === "up" && "text-emerald-300 drop-shadow-[0_0_8px_rgba(63,223,151,0.95)]",
                direction === "down" && "text-rose-300 drop-shadow-[0_0_8px_rgba(235,97,159,0.95)]",
                (!direction || direction === "neutral") && "text-slate-100"
              )}
            >
              {formattedPrice}
            </span>
            <span
              aria-hidden="true"
              className={clsx(
                "w-3 h-3 inline-flex items-center justify-center shrink-0 text-[10px] font-black leading-none transition-all duration-300",
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

          <span
            className={clsx(
              "text-xs font-semibold px-2.5 py-1 rounded-md border transition-all duration-200 flex items-center gap-1 shadow-sm",
              isPositive
                ? "bg-emerald-950/60 text-emerald-400 border-emerald-800/40 "
                : "bg-rose-950/60 text-rose-400 border-rose-800/40 "
            )}
          >
            {isPositive ? (
              <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <TrendingDown className="w-3.5 h-3.5 text-rose-400" />
            )}
            <span>{formatPercent(ticker?.changePercent24h)}</span>
          </span>
        </div>

        {/* Dynamic Asset-Specific Stats Header */}
        {isEquity ? (
          <div className="hidden xl:flex items-center gap-4 text-xs text-slate-400 border-l border-slate-800/80 pl-4">
            <div>
              <span className="text-slate-500">PREV CLOSE: </span>
              <span className="text-slate-200 font-medium tabular-nums">
                {formatEquityPrice(ticker?.previousClose ?? ticker?.open24h, selectedSymbol, isId ? "IDR" : "USD")}
              </span>
            </div>
            <div>
              <span className="text-slate-500">DAY HIGH: </span>
              <span className="text-slate-200 font-medium tabular-nums">
                {formatEquityPrice(ticker?.high24h, selectedSymbol, isId ? "IDR" : "USD")}
              </span>
            </div>
            <div>
              <span className="text-slate-500">DAY LOW: </span>
              <span className="text-slate-200 font-medium tabular-nums">
                {formatEquityPrice(ticker?.low24h, selectedSymbol, isId ? "IDR" : "USD")}
              </span>
            </div>
            <div>
              <span className="text-slate-500">VOL: </span>
              <span className="text-slate-200 font-medium tabular-nums">
                {formatEquityVolume(ticker?.volume24h)}
              </span>
            </div>
            {ticker?.sessionSegment && (
              <div className="flex items-center gap-1.5 pl-1">
                <span className="text-[10px] text-cyan-400 font-semibold px-1.5 py-0.5 rounded bg-cyan-950/60 border border-cyan-800/40 uppercase">
                  {ticker.sessionSegment}
                </span>
              </div>
            )}
          </div>
        ) : isFx ? (
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
        <div className="flex items-center gap-1 bg-[#2a2839] p-1 rounded-md border border-slate-800/80 text-[11px]">
          <button
            onClick={toggleEma20}
            className={clsx(
              "px-2 py-0.5 rounded transition-all cursor-pointer font-medium",
              showEma20
                ? "bg-[#f4c41b]/20 text-[#f4c41b] border border-[#f4c41b]/40 font-bold"
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
                ? "bg-[#c3e6eb]/20 text-[#c3e6eb] border border-[#c3e6eb]/40 font-bold"
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
