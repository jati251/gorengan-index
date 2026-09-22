"use client";

import React from "react";
import { motion } from "framer-motion";
import { clsx } from "clsx";
import type { Timeframe } from "@gorengan/shared";
import { useMarketStore } from "../../../stores/marketStore";

const TIMEFRAMES: { label: string; value: Timeframe }[] = [
  { label: "1s", value: "1s" },
  { label: "5s", value: "5s" },
  { label: "15s", value: "15s" },
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
    <div className="flex items-center gap-0.5 bg-[#060910] p-1 rounded-md border border-slate-800/80 shadow-inner">
      {TIMEFRAMES.map((tf) => {
        const isSelected = selectedTimeframe === tf.value;
        const isSubMinute = ["1s", "5s", "15s"].includes(tf.value);

        return (
          <button
            key={tf.value}
            onClick={() => setSelectedTimeframe(tf.value)}
            className={clsx(
              "relative px-2 py-0.5 sm:px-2.5 sm:py-1 text-xs font-mono rounded transition-colors cursor-pointer select-none",
              isSelected
                ? isSubMinute
                  ? "text-emerald-300 font-bold"
                  : "text-slate-100 font-semibold"
                : isSubMinute
                  ? "text-emerald-500/70 hover:text-emerald-400"
                  : "text-slate-400 hover:text-slate-200"
            )}
          >
            {isSelected && (
              <motion.div
                layoutId="activeTimeframePill"
                className={clsx(
                  "absolute inset-0 rounded shadow-xs",
                  isSubMinute
                    ? "bg-emerald-500/25 border border-emerald-500/40"
                    : "bg-slate-800/90 border border-slate-700/60"
                )}
                transition={{ type: "spring", stiffness: 450, damping: 35 }}
              />
            )}
            <span className="relative z-10">{tf.label}</span>
          </button>
        );
      })}
    </div>
  );
}
