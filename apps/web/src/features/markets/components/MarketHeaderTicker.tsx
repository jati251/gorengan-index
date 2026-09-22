"use client";

import React from "react";
import { Activity } from "lucide-react";
import { useMarketStore } from "@/stores/marketStore";
import { MarketStatusBadge } from "./MarketStatusBadge";
import { DeviceClock } from "./DeviceClock";
import { UserNav } from "@/features/auth";

export function MarketHeaderTicker() {
  const status = useMarketStore((s) => s.providerStatus);

  return (
    <header className="border-b border-white/[0.08] bg-[#060a17]/85 backdrop-blur-xl text-slate-200 font-mono select-none sticky top-0 z-40 shadow-[0_4px_24px_rgba(0,0,0,0.45)]">
      {/* Top utility row */}
      <div className="flex items-center justify-between px-3 sm:px-4 py-2 text-xs">
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

        <div className="flex items-center gap-2.5 sm:gap-3.5">
          <DeviceClock />
          <MarketStatusBadge status={status} />
          <UserNav />
        </div>
      </div>
    </header>
  );
}
