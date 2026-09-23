"use client";

import React, { useState } from "react";
import { Activity, Newspaper } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { clsx } from "clsx";
import { MarketStats } from "./MarketStats";
import { SentimentGauge, NewsFeed } from "@/features/news";
import { useMarketStore } from "@/stores/marketStore";

import { useTranslation } from "@/features/i18n";

export type IntelligenceTab = "pulse" | "news";

interface IntelligenceSidebarProps {
  className?: string;
  initialTab?: IntelligenceTab;
}

export function IntelligenceSidebar({ className, initialTab = "pulse" }: IntelligenceSidebarProps) {
  const { dict } = useTranslation();
  const [activeTab, setActiveTab] = useState<IntelligenceTab>(initialTab);
  const selectedSymbol = useMarketStore((s) => s.selectedSymbol);

  return (
    <div className={clsx("flex flex-col h-full overflow-hidden select-none font-mono", className)}>
      {/* Tab Switcher Header */}
      <div className="p-2.5 border-b border-white/[0.08] bg-[#3c3f5f] shrink-0">
        <div className="flex items-center gap-1.5 p-1 bg-white/[0.03] border border-white/[0.07] rounded-xl relative">
          <button
            type="button"
            onClick={() => setActiveTab("pulse")}
            className={clsx(
              "relative flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-mono font-medium transition-all cursor-pointer z-10 border",
              activeTab === "pulse"
                ? "bg-amber-500/15 border-amber-500/30 text-amber-300 font-semibold shadow-xs"
                : "border-transparent text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]"
            )}
          >
            <Activity className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>{dict.intelligence.tabs.stats}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("news")}
            className={clsx(
              "relative flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-mono font-medium transition-all cursor-pointer z-10 border",
              activeTab === "news"
                ? "bg-cyan-500/15 border-cyan-500/30 text-cyan-300 font-semibold shadow-xs"
                : "border-transparent text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]"
            )}
          >
            <Newspaper className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span>{dict.intelligence.tabs.news}</span>
          </button>
        </div>
      </div>

      {/* Tab Panels with AnimatePresence */}
      <div className="flex-1 overflow-hidden flex flex-col min-h-0 relative">
        <AnimatePresence mode="wait">
          {activeTab === "pulse" ? (
            <motion.div
              key="tab-pulse"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="flex-1 overflow-y-auto min-h-0 p-3 space-y-3.5 divide-y divide-white/[0.05]"
            >
              {/* Active Symbol Header Pill */}
              <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-white/[0.02] border border-white/[0.06] text-[11px] text-slate-400">
                <span className="flex items-center gap-1.5">
                  <span>{dict.intelligence.selectedMarket}</span>
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
                  <span>{dict.intelligence.sentimentTitle}</span>
                </div>
                <SentimentGauge />
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="tab-news"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="flex-1 overflow-hidden flex flex-col min-h-0"
            >
              <NewsFeed />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
