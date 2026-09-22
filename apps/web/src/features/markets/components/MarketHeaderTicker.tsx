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
    <header className="border-b border-white/[0.08] bg-[#060a17]/80 backdrop-blur-xl text-slate-200 font-mono select-none sticky top-0 z-40 shadow-[0_4px_24px_rgba(0,0,0,0.45)]">
      {/* Top utility row */}
      <div className="flex items-center justify-between px-3 sm:px-4 py-2 border-b border-white/[0.05] bg-white/[0.015] text-xs">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 font-bold tracking-wider text-emerald-400">
            <div className="p-1 rounded-md bg-emerald-500/10 border border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.2)]">
              <Activity className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
            </div>
            <span className="tracking-tight text-white font-bold drop-shadow-[0_0_12px_rgba(255,255,255,0.2)]">
              Gorengan<span className="text-emerald-400 text-[10px] ml-1 px-1 py-0.2 rounded bg-emerald-950/60 border border-emerald-500/30">INDEX</span>
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3 sm:gap-4">
          <DeviceClock />
          <MarketStatusBadge status={status} />
        </div>
      </div>

      {/* Marquee ticker strip with edge fading */}
      <div className="relative overflow-hidden whitespace-nowrap py-1.5 px-3 bg-black/30 backdrop-blur-md text-[11px] border-b border-white/[0.04] flex items-center">
        {/* Left fade gradient */}
        <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-[#040711] to-transparent z-10" />

        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar scroll-smooth w-full">
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
                  className="flex items-center gap-2 px-2.5 py-1 rounded-md bg-white/[0.025] hover:bg-white/[0.06] border border-white/[0.05] hover:border-white/[0.12] transition-all cursor-pointer shrink-0"
                >
                  <span className="font-semibold text-slate-300">{t.symbol}</span>
                  <span className="text-white font-medium tabular-nums">{formattedPrice}</span>
                  <span
                    className={`font-semibold tabular-nums ${
                      isPositive ? "text-emerald-400 drop-shadow-[0_0_6px_rgba(16,185,129,0.3)]" : "text-rose-400 drop-shadow-[0_0_6px_rgba(244,63,94,0.3)]"
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
        <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-[#040711] to-transparent z-10" />
      </div>
    </header>
  );
}
