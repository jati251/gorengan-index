"use client";

import React from "react";
import { Activity, ShieldCheck } from "lucide-react";
import { useMarketStore } from "../../../stores/marketStore";
import { formatPrice, formatPercent, formatTime } from "../../../utils/formatters";
import { MarketStatusBadge } from "./MarketStatusBadge";
import { DeviceClock } from "./DeviceClock";

export function MarketHeaderTicker() {
  const tickers = useMarketStore((s) => s.tickers);
  const status = useMarketStore((s) => s.providerStatus);
  const lastEventAt = useMarketStore((s) => s.lastEventAt);
  const setSelectedSymbol = useMarketStore((s) => s.setSelectedSymbol);

  const tickerList = Object.values(tickers);

  return (
    <header className="border-b border-slate-800 bg-[#090d16] text-slate-200 font-mono select-none sticky top-0 z-40">
      {/* Top utility row */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-800/60 text-xs">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 font-bold tracking-wider text-emerald-400">
            <Activity className="w-4 h-4 text-emerald-400" />
            <span>GORENGAN TERMINAL</span>
            <span className="text-[10px] text-slate-500 font-normal ml-1">v1.0-realtime</span>
          </div>

          <div className="hidden md:flex items-center gap-2 pl-3 border-l border-slate-800 text-slate-400">
            <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-[11px]">ARCH: SELF-HOSTED // DIRECT VENUES</span>
          </div>
        </div>

        <div className="flex items-center gap-3 sm:gap-4">
          <DeviceClock />
          <MarketStatusBadge status={status} />
          {lastEventAt > 0 && (
            <span className="text-[11px] text-slate-400 hidden lg:inline">
              LAST TICK: {formatTime(lastEventAt)}
            </span>
          )}
        </div>
      </div>

      {/* Marquee ticker strip */}
      <div className="relative overflow-hidden whitespace-nowrap py-1.5 px-2 bg-[#060910] text-[11px] border-b border-slate-900 flex items-center">
        <div className="flex items-center gap-6 animate-none overflow-x-auto no-scrollbar scroll-smooth">
          {tickerList.length === 0 ? (
            <span className="text-slate-500 italic px-2">
              Waiting for live market feed...
            </span>
          ) : (
            tickerList.map((t) => {
              const isPositive = (t.changePercent24h ?? 0) >= 0;
              return (
                <button
                  key={t.symbol}
                  onClick={() => setSelectedSymbol(t.symbol)}
                  className="flex items-center gap-2 px-2 py-0.5 rounded hover:bg-slate-800/60 transition-colors cursor-pointer"
                >
                  <span className="font-semibold text-slate-300">{t.symbol}</span>
                  <span className="text-slate-100">${formatPrice(t.price)}</span>
                  <span
                    className={
                      isPositive
                        ? "text-emerald-400 font-semibold"
                        : "text-rose-400 font-semibold"
                    }
                  >
                    {formatPercent(t.changePercent24h)}
                  </span>
                </button>
              );
            })
          )}
        </div>
      </div>
    </header>
  );
}
