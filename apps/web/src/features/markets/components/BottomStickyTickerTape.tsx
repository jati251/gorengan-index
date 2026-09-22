"use client";

import React, { useMemo } from "react";
import { useMarketStore } from "@/stores/marketStore";
import { formatPrice, formatPercent } from "@/utils/formatters";
import { formatFxPrice, isFxSymbol } from "@/features/forex";
import { formatEquityPrice, isUsEquitySymbol, isIdxEquitySymbol } from "@/features/equities";
import type { MarketTicker } from "@gorengan/shared";

export function BottomStickyTickerTape() {
  const tickers = useMarketStore((s) => s.tickers);
  const selectedSymbol = useMarketStore((s) => s.selectedSymbol);
  const setSelectedSymbol = useMarketStore((s) => s.setSelectedSymbol);

  const tickerList = useMemo(() => Object.values(tickers), [tickers]);

  // Duplicate items twice to allow continuous seamless 50% translation marquee
  const loopedTickers = useMemo(() => {
    if (tickerList.length === 0) return [];
    return [...tickerList, ...tickerList];
  }, [tickerList]);

  return (
    <div
      aria-label="Real-time Market Ticker Tape"
      className="fixed bottom-[52px] lg:bottom-0 left-0 right-0 z-40 h-9 bg-[#050814]/90 backdrop-blur-xl border-t border-white/[0.08] flex items-center font-mono select-none overflow-hidden shadow-[0_-4px_20px_rgba(0,0,0,0.5)]"
    >
      {/* Marquee Track Container with Edge Fades */}
      <div className="relative flex-1 w-full overflow-hidden h-full flex items-center">
        {/* Left fade gradient */}
        <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-[#050814] to-transparent z-10" />

        {loopedTickers.length === 0 ? (
          <div className="px-4 text-xs text-slate-500 italic">
            Connecting to live market stream...
          </div>
        ) : (
          <div className="animate-ticker-marquee flex items-center gap-2 py-0.5">
            {loopedTickers.map((t: MarketTicker, idx: number) => {
              const isPositive = (t.changePercent24h ?? 0) >= 0;
              const isSelected = t.symbol === selectedSymbol;
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
                <button
                  key={`${t.symbol}-${idx}`}
                  type="button"
                  onClick={() => setSelectedSymbol(t.symbol)}
                  className={`flex items-center gap-2 px-2.5 py-1 rounded text-[11px] transition-all cursor-pointer shrink-0 border ${
                    isSelected
                      ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.15)] font-bold"
                      : "bg-white/[0.02] hover:bg-white/[0.07] border-white/[0.05] hover:border-white/[0.12] text-slate-300"
                  }`}
                  title={`Select ${t.symbol}`}
                >
                  <span className="font-semibold text-slate-200">{t.symbol}</span>
                  <span className="font-medium text-white tabular-nums">{formattedPrice}</span>
                  <span
                    className={`font-semibold tabular-nums text-[10px] ${
                      isPositive
                        ? "text-emerald-400 drop-shadow-[0_0_6px_rgba(16,185,129,0.3)]"
                        : "text-rose-400 drop-shadow-[0_0_6px_rgba(244,63,94,0.3)]"
                    }`}
                  >
                    {formatPercent(t.changePercent24h)}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Right fade gradient */}
        <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-[#050814] to-transparent z-10" />
      </div>
    </div>
  );
}
