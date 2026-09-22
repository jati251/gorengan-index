"use client";

import React from "react";
import { TrendingUp, LayoutGrid, Newspaper } from "lucide-react";
import { motion } from "framer-motion";
import { clsx } from "clsx";

export type MobileTab = "chart" | "markets" | "intel";

interface MobileNavigationBarProps {
  activeTab: MobileTab;
  onChangeTab: (tab: MobileTab) => void;
  selectedSymbol: string;
}

const TABS: { id: MobileTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "chart", label: "Chart", icon: TrendingUp },
  { id: "markets", label: "Markets", icon: LayoutGrid },
  { id: "intel", label: "News & Intel", icon: Newspaper },
];

export function MobileNavigationBar({
  activeTab,
  onChangeTab,
  selectedSymbol,
}: MobileNavigationBarProps) {
  return (
    <nav
      aria-label="Mobile navigation"
      className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#070a12]/95 backdrop-blur-md border-t border-slate-800/90 font-mono select-none px-2 py-1.5 pb-[calc(0.375rem+env(safe-area-inset-bottom,0px))]"
    >
      <div className="grid grid-cols-3 gap-1 max-w-md mx-auto">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;

          return (
            <button
              key={tab.id}
              onClick={() => onChangeTab(tab.id)}
              className={clsx(
                "relative py-2 px-2 rounded-lg transition-colors cursor-pointer flex flex-col items-center justify-center gap-1",
                isActive
                  ? "text-emerald-400 font-bold"
                  : "text-slate-400 hover:text-slate-200"
              )}
            >
              {isActive && (
                <motion.div
                  layoutId="activeMobileTabPill"
                  className="absolute inset-0 bg-slate-800/80 rounded-lg border border-slate-700/60 shadow-xs"
                  transition={{ type: "spring", stiffness: 450, damping: 35 }}
                />
              )}

              <span className="relative z-10 flex items-center justify-center">
                <Icon className={clsx("w-4 h-4", isActive ? "text-emerald-400" : "text-slate-400")} />
              </span>

              <span className="relative z-10 text-[10px] tracking-tight flex items-center gap-1">
                {tab.label}
                {tab.id === "chart" && (
                  <span className="text-[8px] px-1 py-0 rounded bg-slate-900 border border-slate-700/60 text-slate-300 font-semibold truncate max-w-[60px]">
                    {selectedSymbol}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
