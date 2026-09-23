"use client";

import React from "react";
import { Gauge } from "lucide-react";
import { clsx } from "clsx";
import { useSentimentQuery } from "../api/useSentimentQuery";
import { SentimentSkeleton } from "./NewsSkeletons";

export function SentimentGauge({ compact = false }: { compact?: boolean }) {
  const { data: sentiment, isLoading, isError } = useSentimentQuery();

  const value = sentiment?.value ?? 0;
  const classification = sentiment?.classification ?? "Unavailable";

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
      ? "bg-emerald-500 shadow-[0_0_8px_rgba(63,223,151,0.5)]"
      : value >= 45
        ? "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.5)]"
        : "bg-rose-500 shadow-[0_0_8px_rgba(235,97,159,0.5)]";

  if (compact) {
    return (
      <div
        className={clsx(
          "flex items-center gap-1.5 px-2 py-0.5 rounded border text-xs font-mono select-none transition-colors",
          colorClass
        )}
        title={sentiment ? `Fear & Greed Index: ${value}/100 (${classification})` : "Sentiment unavailable"}
      >
        <Gauge className="w-3.5 h-3.5" />
        <span className="font-bold tabular-nums">{sentiment ? value : "—"}</span>
        <span className="text-[10px] uppercase font-semibold hidden sm:inline">
          {classification}
        </span>
      </div>
    );
  }

  if (isLoading && !compact) return <SentimentSkeleton />;
  if (!sentiment && !compact) return <div role="status" className="border border-[#55607e] bg-[#3c3f5f] p-4 text-sm text-slate-300">{isError ? "Sentiment is unavailable right now." : "No sentiment data yet."}</div>;

  return (
    <div className="flex flex-col gap-2 p-3.5 rounded-xl bg-white/[0.025] backdrop-blur-xl border border-white/[0.08] shadow-[0_4px_24px_rgba(0,0,0,0.3)] font-mono select-none relative overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/[0.15] to-transparent pointer-events-none" />
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5 text-slate-300">
          <Gauge className="w-3.5 h-3.5 text-emerald-400" />
          <span className="font-semibold text-slate-200">Fear & Greed Index</span>
        </div>
        <div className={clsx("px-2 py-0.5 rounded-md text-[11px] font-bold border backdrop-blur-md", colorClass)}>
          {isLoading ? "--" : `${value} · ${classification}`}
        </div>
      </div>

      {/* Meter Bar */}
      <div className="w-full h-2.5 bg-black/40 rounded-full overflow-hidden relative border border-white/[0.08] p-0.5 shadow-inner">
        <div
          className={clsx("h-full transition-all duration-500 rounded-full", barColor)}
          style={{ width: `${value}%` }}
        />
      </div>

      <div className="flex justify-between text-[9px] text-slate-400 font-mono">
        <span>0 Extreme Fear</span>
        <span>50 Neutral</span>
        <span>100 Extreme Greed</span>
      </div>
    </div>
  );
}
