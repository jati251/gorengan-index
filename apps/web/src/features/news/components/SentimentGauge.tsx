"use client";

import React from "react";
import { Gauge } from "lucide-react";
import { clsx } from "clsx";
import { useSentimentQuery } from "../api/useSentimentQuery";
import { SentimentSkeleton } from "../../../components/ui/skeleton";

export function SentimentGauge({ compact = false }: { compact?: boolean }) {
  const { data: sentiment, isLoading } = useSentimentQuery();

  const value = sentiment?.value ?? 70;
  const classification = sentiment?.classification ?? "Greed";

  const colorClass =
    value >= 75
      ? "text-emerald-400 border-emerald-500/40 bg-emerald-950/40"
      : value >= 55
        ? "text-emerald-300 border-emerald-600/40 bg-emerald-950/30"
        : value >= 45
          ? "text-amber-300 border-amber-500/40 bg-amber-950/30"
          : value >= 25
            ? "text-orange-400 border-orange-500/40 bg-orange-950/30"
            : "text-rose-400 border-rose-500/40 bg-rose-950/30";

  const barColor =
    value >= 55
      ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"
      : value >= 45
        ? "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.5)]"
        : "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]";

  if (compact) {
    return (
      <div
        className={clsx(
          "flex items-center gap-1.5 px-2 py-0.5 rounded border text-xs font-mono select-none transition-colors",
          colorClass
        )}
        title={`Fear & Greed Index: ${value}/100 (${classification})`}
      >
        <Gauge className="w-3.5 h-3.5" />
        <span className="font-bold tabular-nums">{isLoading ? "--" : value}</span>
        <span className="text-[10px] uppercase font-semibold hidden sm:inline">
          {classification}
        </span>
      </div>
    );
  }

  if (isLoading && !compact) {
    return <SentimentSkeleton />;
  }

  return (
    <div className="flex flex-col gap-1.5 p-3 rounded-lg bg-[#060910] border border-slate-800 font-mono select-none">
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5 text-slate-400">
          <Gauge className="w-3.5 h-3.5 text-emerald-400" />
          <span className="font-semibold text-slate-300">Fear & Greed Index</span>
        </div>
        <div className={clsx("px-2 py-0.5 rounded text-[11px] font-bold border", colorClass)}>
          {isLoading ? "--" : `${value} · ${classification}`}
        </div>
      </div>

      {/* Meter Bar */}
      <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden relative border border-slate-800/80">
        <div
          className={clsx("h-full transition-all duration-500 rounded-full", barColor)}
          style={{ width: `${value}%` }}
        />
      </div>

      <div className="flex justify-between text-[9px] text-slate-500 font-mono">
        <span>0 Extreme Fear</span>
        <span>50 Neutral</span>
        <span>100 Extreme Greed</span>
      </div>
    </div>
  );
}
