"use client";

import React, { useMemo } from "react";
import { ArrowUp, ArrowDown, Radio, Layers } from "lucide-react";
import { clsx } from "clsx";
import { useOrderBook } from "../hooks/useOrderBook";
import type { OrderBookLevel } from "../types";
import { useTranslation } from "@/features/i18n";

interface OrderBookProps {
  className?: string;
  maxRows?: number;
}

function formatNumber(num: number, decimals: number): string {
  if (num == null || isNaN(num)) return "-";
  return num.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function OrderBook({ className, maxRows = 10 }: OrderBookProps) {
  const { dict } = useTranslation();
  const {
    symbol,
    bids,
    asks,
    spread,
    spreadPercent,
    lastPrice,
    isLoading,
    source,
    displayDecimals,
    viewMode,
    setViewMode,
  } = useOrderBook();

  // Slice based on viewMode and maxRows
  const visibleAsks = useMemo(() => {
    if (viewMode === "bids") return [];
    const limit = viewMode === "asks" ? maxRows * 2 : maxRows;
    // Show closest to market at bottom of asks list
    return asks.slice(0, limit).reverse();
  }, [asks, viewMode, maxRows]);

  const visibleBids = useMemo(() => {
    if (viewMode === "asks") return [];
    const limit = viewMode === "bids" ? maxRows * 2 : maxRows;
    return bids.slice(0, limit);
  }, [bids, viewMode, maxRows]);

  return (
    <div
      className={clsx(
        "flex flex-col h-full font-mono text-[11px] select-none bg-[#3c3f5f] overflow-hidden",
        className
      )}
    >
      {/* Top Controls Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/[0.08] bg-[#323550] shrink-0">
        <div className="flex items-center gap-2">
          <span className="font-bold text-white text-xs tracking-wide">
            {dict.intelligence.orderbook?.title ?? "ORDER BOOK"}
          </span>
          <span
            className={clsx(
              "flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider border",
              source === "binance_live"
                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                : "bg-amber-500/10 text-amber-400 border-amber-500/20"
            )}
          >
            <span
              className={clsx(
                "w-1.5 h-1.5 rounded-full",
                source === "binance_live" ? "bg-emerald-400 animate-pulse" : "bg-amber-400"
              )}
            />
            {source === "binance_live" ? "LIVE 100ms" : "DEPTH"}
          </span>
        </div>

        {/* View Mode Toggle Buttons */}
        <div className="flex items-center bg-white/[0.04] p-0.5 rounded border border-white/[0.08]">
          <button
            type="button"
            title="All (Bids & Asks)"
            onClick={() => setViewMode("all")}
            className={clsx(
              "px-1.5 py-0.5 rounded text-[10px] transition-colors cursor-pointer",
              viewMode === "all" ? "bg-white/[0.15] text-white font-bold" : "text-slate-400 hover:text-white"
            )}
          >
            <Layers className="w-3 h-3" />
          </button>
          <button
            type="button"
            title="Bids Only (Buy)"
            onClick={() => setViewMode("bids")}
            className={clsx(
              "px-1.5 py-0.5 rounded text-[10px] transition-colors cursor-pointer text-emerald-400",
              viewMode === "bids" ? "bg-emerald-500/20 font-bold" : "opacity-60 hover:opacity-100"
            )}
          >
            <ArrowUp className="w-3 h-3" />
          </button>
          <button
            type="button"
            title="Asks Only (Sell)"
            onClick={() => setViewMode("asks")}
            className={clsx(
              "px-1.5 py-0.5 rounded text-[10px] transition-colors cursor-pointer text-red-400",
              viewMode === "asks" ? "bg-red-500/20 font-bold" : "opacity-60 hover:opacity-100"
            )}
          >
            <ArrowDown className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Table Column Headers */}
      <div className="grid grid-cols-3 px-3 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider border-b border-white/[0.04] bg-white/[0.01] shrink-0">
        <span className="text-left">{dict.intelligence.orderbook?.price ?? "Price"}</span>
        <span className="text-right">{dict.intelligence.orderbook?.size ?? "Size"}</span>
        <span className="text-right">{dict.intelligence.orderbook?.total ?? "Total"}</span>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-hidden flex flex-col justify-between p-1 min-h-0">
        {isLoading && bids.length === 0 && asks.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-2 text-slate-400 text-xs">
            <Radio className="w-5 h-5 animate-spin text-cyan-400" />
            <span>{dict.intelligence.orderbook?.connecting ?? "Connecting live depth stream..."}</span>
          </div>
        ) : (
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            {/* ASKS (SELL ORDERS) */}
            {viewMode !== "bids" && (
              <div className="flex-1 flex flex-col justify-end overflow-hidden space-y-[1px]">
                {visibleAsks.map((ask) => (
                  <OrderBookRow
                    key={`ask-${ask.price}`}
                    level={ask}
                    type="ask"
                    decimals={displayDecimals}
                  />
                ))}
              </div>
            )}

            {/* SPREAD & LAST PRICE RIBBON */}
            <div className="my-1 py-1 px-3 bg-white/[0.04] border-y border-white/[0.08] flex items-center justify-between text-xs font-semibold shrink-0">
              <div className="flex items-center gap-1.5">
                <span className="text-white font-bold text-sm tracking-tight">
                  {formatNumber(lastPrice, displayDecimals)}
                </span>
                <span className="text-[10px] text-slate-400 font-normal">
                  {symbol.split("-")[1] || "USDT"}
                </span>
              </div>
              <div className="text-[10px] text-slate-400 flex items-center gap-1.5">
                <span>{dict.intelligence.orderbook?.spread ?? "Spread"}</span>
                <span className="text-slate-200 font-mono">
                  {formatNumber(spread, displayDecimals)}
                </span>
                <span className="text-[9px] text-slate-400 font-mono">
                  ({spreadPercent.toFixed(2)}%)
                </span>
              </div>
            </div>

            {/* BIDS (BUY ORDERS) */}
            {viewMode !== "asks" && (
              <div className="flex-1 flex flex-col justify-start overflow-hidden space-y-[1px]">
                {visibleBids.map((bid) => (
                  <OrderBookRow
                    key={`bid-${bid.price}`}
                    level={bid}
                    type="bid"
                    decimals={displayDecimals}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="px-3 py-1.5 border-t border-white/[0.06] bg-[#323550] flex items-center justify-between text-[10px] text-slate-400 shrink-0">
        <span className="truncate max-w-[120px]">{symbol}</span>
        <span className="font-mono text-[9px] text-slate-400">
          {source === "binance_live" ? "Binance WebSocket" : "Realtime Quotes"}
        </span>
      </div>
    </div>
  );
}

interface OrderBookRowProps {
  level: OrderBookLevel;
  type: "bid" | "ask";
  decimals: number;
}

function OrderBookRow({ level, type, decimals }: OrderBookRowProps) {
  const isBid = type === "bid";
  const textColor = isBid ? "text-emerald-400" : "text-rose-400";
  const depthBg = isBid ? "bg-emerald-500/15" : "bg-rose-500/15";

  // Size formatting helper
  const sizeDecimals = level.size < 1 ? 4 : 2;
  const totalDecimals = level.total < 1 ? 4 : 2;

  return (
    <div className="relative grid grid-cols-3 px-2 py-[2px] items-center text-[10.5px] font-mono leading-none hover:bg-white/[0.04] transition-colors rounded-xs group cursor-pointer">
      {/* Background Visual Depth Bar */}
      <div
        className={clsx(
          "absolute inset-y-0 right-0 pointer-events-none transition-all duration-100",
          depthBg
        )}
        style={{ width: `${Math.min(100, Math.max(2, level.depthPercent))}%` }}
      />

      {/* Price */}
      <span className={clsx("text-left font-semibold relative z-10", textColor)}>
        {formatNumber(level.price, decimals)}
      </span>

      {/* Size */}
      <span className="text-right text-slate-300 relative z-10">
        {formatNumber(level.size, sizeDecimals)}
      </span>

      {/* Cumulative Total */}
      <span className="text-right text-slate-400 relative z-10">
        {formatNumber(level.total, totalDecimals)}
      </span>
    </div>
  );
}
