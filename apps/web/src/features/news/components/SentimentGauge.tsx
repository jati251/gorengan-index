"use client";

import React from "react";
import { Gauge } from "lucide-react";
import { clsx } from "clsx";
import { useSentimentQuery } from "../api/useSentimentQuery";
import { SentimentSkeleton } from "./NewsSkeletons";
import { useTranslation } from "@/features/i18n";

function getSentimentColorClass(value: number): string {
  if (value >= 75) return "text-emerald-400 border-emerald-500/40 bg-emerald-950/40";
  if (value >= 55) return "text-emerald-300 border-emerald-600/40 bg-emerald-950/30";
  if (value >= 45) return "text-amber-300 border-amber-500/40 bg-amber-950/30";
  if (value >= 25) return "text-orange-400 border-orange-500/40 bg-orange-950/30";
  return "text-rose-400 border-rose-500/40 bg-rose-950/30";
}

function getSentimentBarColor(value: number): string {
  if (value >= 55) return "bg-emerald-500 shadow-[0_0_8px_rgba(63,223,151,0.5)]";
  if (value >= 45) return "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.5)]";
  return "bg-rose-500 shadow-[0_0_8px_rgba(235,97,159,0.5)]";
}

export function SentimentGauge({ compact = false }: { compact?: boolean }) {
  const { dict } = useTranslation();
  const { data: sentiment, isLoading, isError } = useSentimentQuery();

  const value = sentiment?.value ?? 0;
  const rawClassification = sentiment?.classification ?? "Unavailable";

  const getLocalizedClassification = (raw: string) => {
    const lower = raw.toLowerCase();
    if (lower.includes("extreme fear")) return dict.sentiment.levels.extremeFear;
    if (lower.includes("extreme greed")) return dict.sentiment.levels.extremeGreed;
    if (lower.includes("fear")) return dict.sentiment.levels.fear;
    if (lower.includes("greed")) return dict.sentiment.levels.greed;
    if (lower.includes("neutral")) return dict.sentiment.levels.neutral;
    return dict.sentiment.levels.unavailable;
  };

  const classification = getLocalizedClassification(rawClassification);
  const colorClass = getSentimentColorClass(value);
  const barColor = getSentimentBarColor(value);

  if (compact) {
    return (
      <div
        className={clsx(
          "flex items-center gap-1.5 px-2 py-0.5 rounded border text-xs font-mono select-none transition-colors",
          colorClass
        )}
        title={sentiment ? `${dict.sentiment.title}: ${value}/100 (${classification})` : dict.sentiment.levels.unavailable}
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
  if (!sentiment && !compact) {
    return (
      <div role="status" className="border border-[#55607e] bg-[#3c3f5f] p-4 text-sm text-slate-300">
        {isError ? dict.sentiment.labels.unavailableMsg : dict.sentiment.labels.noDataMsg}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 p-3.5 rounded-xl bg-white/[0.025] backdrop-blur-xl border border-white/[0.08] shadow-[0_4px_24px_rgba(0,0,0,0.3)] font-mono select-none relative overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/[0.15] to-transparent pointer-events-none" />
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5 text-slate-300">
          <Gauge className="w-3.5 h-3.5 text-emerald-400" />
          <span className="font-semibold text-slate-200">{dict.sentiment.title}</span>
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
        <span>{dict.sentiment.labels.scaleZero}</span>
        <span>{dict.sentiment.labels.scaleFifty}</span>
        <span>{dict.sentiment.labels.scaleHundred}</span>
      </div>
    </div>
  );
}
