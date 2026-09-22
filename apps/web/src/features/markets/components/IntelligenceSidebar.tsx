"use client";

import React, { useState } from "react";
import { Activity, Newspaper, Sparkles } from "lucide-react";
import { clsx } from "clsx";
import { MarketStats } from "./MarketStats";
import { SentimentGauge, NewsFeed } from "@/features/news";
import { useMarketStore } from "@/stores/marketStore";

export type IntelligenceTab = "pulse" | "news";

interface IntelligenceSidebarProps {
  className?: string;
}

export function IntelligenceSidebar({ className }: IntelligenceSidebarProps) {
  const [activeTab, setActiveTab] = useState<IntelligenceTab>("pulse");
  const selectedSymbol = useMarketStore((s) => s.selectedSymbol);

  return (
    <div className={clsx("flex flex-col h-full overflow-hidden select-none font-mono", className)}>
      {/* Tab Switcher Header */}
      <div className="p-2.5 border-b border-white/[0.08] bg-[#080d1b]/80 backdrop-blur-xl shrink-0">
        <div className="flex items-center gap-1.5 p-1 bg-white/[0.03] border border-white/[0.07] rounded-xl">
          <button
            type="button"
            onClick={() => setActiveTab("pulse")}
            className={clsx(
              "flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-mono font-medium transition-all duration-200 cursor-pointer",
              activeTab === "pulse"
                ? "bg-gradient-to-r from-amber-500/20 via-amber-500/10 to-transparent text-amber-300 border border-amber-500/30 shadow-[0_2px_12px_rgba(245,158,11,0.15)] font-semibold"
                : "text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]"
            )}
          >
            <Activity className="w-3.5 h-3.5 text-amber-400" />
            <span>Market Pulse</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("news")}
            className={clsx(
              "flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-mono font-medium transition-all duration-200 cursor-pointer",
              activeTab === "news"
                ? "bg-gradient-to-r from-cyan-500/20 via-cyan-500/10 to-transparent text-cyan-300 border border-cyan-500/30 shadow-[0_2px_12px_rgba(6,182,212,0.15)] font-semibold"
                : "text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]"
            )}
          >
            <Newspaper className="w-3.5 h-3.5 text-cyan-400" />
            <span>Market News</span>
          </button>
        </div>
      </div>

      {/* Tab 1: Market Pulse Panel */}
      {activeTab === "pulse" && (
        <div className="flex-1 overflow-y-auto min-h-0 p-3 space-y-3.5 divide-y divide-white/[0.05]">
          {/* Active Symbol Header Pill */}
          <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-white/[0.02] border border-white/[0.06] text-[11px] text-slate-400">
            <span className="flex items-center gap-1.5">
              <Sparkles className="w-3 h-3 text-amber-400" />
              <span>Ticker Focus</span>
            </span>
            <span className="font-bold text-white font-mono bg-white/[0.06] px-2 py-0.5 rounded border border-white/[0.08]">
              {selectedSymbol}
            </span>
          </div>

          {/* Key Market Stats */}
          <div className="pt-2">
            <MarketStats />
          </div>

          {/* Fear & Greed / AI Sentiment Gauge */}
          <div className="pt-3">
            <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-2 flex items-center gap-1.5">
              <span>Sentiment Index</span>
            </div>
            <SentimentGauge />
          </div>
        </div>
      )}

      {/* Tab 2: Market News Wire Panel */}
      {activeTab === "news" && (
        <div className="flex-1 overflow-hidden flex flex-col min-h-0">
          <NewsFeed />
        </div>
      )}
    </div>
  );
}
