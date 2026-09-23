"use client";

import React, { useState } from "react";
import { Activity, Newspaper } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { clsx } from "clsx";
import { MarketStats } from "./MarketStats";
import { SentimentGauge, NewsFeed } from "@/features/news";
import { useMarketStore } from "@/stores/marketStore";

export type IntelligenceTab = "pulse" | "news";

interface IntelligenceSidebarProps {
  className?: string;
  initialTab?: IntelligenceTab;
}

export function IntelligenceSidebar({ className, initialTab = "pulse" }: IntelligenceSidebarProps) {
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
              "relative flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-mono font-medium transition-colors cursor-pointer z-10",
              activeTab === "pulse" ? "text-amber-300 font-semibold" : "text-slate-400 hover:text-slate-200"
            )}
          >
            {activeTab === "pulse" && (
              <motion.div
                layoutId="activeIntelligenceTabIndicator"
                className="absolute inset-0 rounded-lg bg-amber-500/15 border border-amber-500/30"
                transition={{ type: "spring", stiffness: 450, damping: 35 }}
              />
            )}
            <Activity className="w-3.5 h-3.5 text-amber-400 relative z-10" />
            <span className="relative z-10">Market stats</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("news")}
            className={clsx(
              "relative flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-mono font-medium transition-colors cursor-pointer z-10",
              activeTab === "news" ? "text-cyan-300 font-semibold" : "text-slate-400 hover:text-slate-200"
            )}
          >
            {activeTab === "news" && (
              <motion.div
                layoutId="activeIntelligenceTabIndicator"
                className="absolute inset-0 rounded-lg bg-amber-500/15 border border-amber-500/30"
                transition={{ type: "spring", stiffness: 450, damping: 35 }}
              />
            )}
            <Newspaper className="w-3.5 h-3.5 text-cyan-400 relative z-10" />
            <span className="relative z-10">News</span>
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

                  <span>Selected market</span>
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
