"use client";

import React from "react";
import { clsx } from "clsx";
import type { Timeframe } from "@gorengan/shared";
import { useMarketStore } from "../../../stores/marketStore";

const TIMEFRAMES: { label: string; value: Timeframe }[] = [
  { label: "1m", value: "1m" },
  { label: "5m", value: "5m" },
  { label: "15m", value: "15m" },
  { label: "1h", value: "1h" },
  { label: "4h", value: "4h" },
  { label: "1d", value: "1d" },
];

export function TimeframeSelector() {
  const selectedTimeframe = useMarketStore((s) => s.selectedTimeframe);
  const setSelectedTimeframe = useMarketStore((s) => s.setSelectedTimeframe);

  return (
    <div className="flex items-center gap-1 bg-slate-900/80 p-0.5 rounded border border-slate-800">
      {TIMEFRAMES.map((tf) => {
        const isSelected = selectedTimeframe === tf.value;
        return (
          <button
            key={tf.value}
            onClick={() => setSelectedTimeframe(tf.value)}
            className={clsx(
              "px-2.5 py-1 text-xs font-mono rounded transition-colors cursor-pointer",
              isSelected
                ? "bg-slate-800 text-emerald-400 font-semibold shadow-xs"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
            )}
          >
            {tf.label}
          </button>
        );
      })}
    </div>
  );
}
