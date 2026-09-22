"use client";

import React from "react";
import { Activity } from "lucide-react";
import { motion } from "framer-motion";
import { useMarketStore } from "@/stores/marketStore";
import { formatPrice, formatPercent } from "@/utils/formatters";
import { formatFxPrice, isFxSymbol } from "@/features/forex";
import { formatEquityPrice, isUsEquitySymbol, isIdxEquitySymbol } from "@/features/equities";
import { MarketStatusBadge } from "./MarketStatusBadge";
import { DeviceClock } from "./DeviceClock";

export function MarketHeaderTicker() {
  const tickers = useMarketStore((s) => s.tickers);
  const status = useMarketStore((s) => s.providerStatus);
  const setSelectedSymbol = useMarketStore((s) => s.setSelectedSymbol);

  const tickerList = Object.values(tickers);

  return (
    <header className="border-b border-slate-800/80 bg-[#080c16]/95 backdrop-blur-md text-slate-200 font-mono select-none sticky top-0 z-40 shadow-md">
      {/* Top utility row */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-800/60 text-xs">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 font-bold tracking-wider text-emerald-400">
            <Activity className="w-4 h-4 text-emerald-400 animate-pulse" />
            <span className="tracking-tight text-slate-100 font-bold">Gorengan</span>
          </div>
        </div>

        <div className="flex items-center gap-3 sm:gap-4">
          <DeviceClock />
          <MarketStatusBadge status={status} />
        </div>
      </div>

      {/* Marquee ticker strip with edge fading */}
      <div className="relative overflow-hidden whitespace-nowrap py-1.5 px-3 bg-[#05070d] text-[11px] border-b border-slate-900 flex items-center">
        {/* Left fade gradient */}
        <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-6 bg-gradient-to-r from-[#05070d] to-transparent z-10" />

        <div className="flex items-center gap-5 overflow-x-auto no-scrollbar scroll-smooth w-full">
          {tickerList.length === 0 ? (
            <span className="text-slate-500 italic px-2">
              Waiting for market data...
            </span>
          ) : (
            tickerList.map((t) => {
              const isPositive = (t.changePercent24h ?? 0) >= 0;
              const isFx = isFxSymbol(t.symbol);
              const isUs = isUsEquitySymbol(t.symbol);
              const isId = isIdxEquitySymbol(t.symbol);

              let formattedPrice = `$${formatPrice(t.price)}`;
              if (isFx) {
                formattedPrice = formatFxPrice(t.price, t.symbol);
              } else if (isId) {
                formattedPrice = formatEquityPrice(t.price, t.symbol, "IDR");
              } else if (isUs) {
                formattedPrice = formatEquityPrice(t.price, t.symbol, "USD");
              }

              return (
                <motion.button
                  key={t.symbol}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setSelectedSymbol(t.symbol)}
                  className="flex items-center gap-2 px-2 py-0.5 rounded hover:bg-slate-800/60 transition-colors cursor-pointer shrink-0 border border-transparent hover:border-slate-800"
                >
                  <span className="font-semibold text-slate-300">{t.symbol}</span>
                  <span className="text-slate-100 font-medium tabular-nums">{formattedPrice}</span>
                  <span
                    className={`font-semibold tabular-nums ${
                      isPositive ? "text-emerald-400" : "text-rose-400"
                    }`}
                  >
                    {formatPercent(t.changePercent24h)}
                  </span>
                </motion.button>
              );
            })
          )}
        </div>

        {/* Right fade gradient */}
        <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-6 bg-gradient-to-l from-[#05070d] to-transparent z-10" />
      </div>
    </header>
  );
}
