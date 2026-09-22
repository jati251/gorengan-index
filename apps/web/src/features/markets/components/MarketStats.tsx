"use client";

import React from "react";
import { motion } from "framer-motion";
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Activity,
  Layers,
} from "lucide-react";
import { clsx } from "clsx";
import { useMarketStore } from "../../../stores/marketStore";
import { formatPrice, formatVolume } from "../../../utils/formatters";

interface StatCardProps {
  label: string;
  value: string;
  icon: React.ReactNode;
  accent?: "emerald" | "rose" | "cyan" | "amber" | "slate";
  subtext?: string;
}

function StatCard({ label, value, icon, accent = "slate", subtext }: StatCardProps) {
  const accentClasses = {
    emerald: "text-emerald-400 bg-emerald-950/30 border-emerald-800/30",
    rose: "text-rose-400 bg-rose-950/30 border-rose-800/30",
    cyan: "text-cyan-400 bg-cyan-950/30 border-cyan-800/30",
    amber: "text-amber-400 bg-amber-950/30 border-amber-800/30",
    slate: "text-slate-300 bg-slate-800/30 border-slate-700/30",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className={clsx(
        "flex items-center gap-2.5 px-3 py-2 rounded-lg border font-mono transition-colors",
        accentClasses[accent]
      )}
    >
      <div className="shrink-0 opacity-70">{icon}</div>
      <div className="min-w-0 flex-1">
        <div className="text-[9px] uppercase tracking-wider text-slate-500 font-semibold truncate">
          {label}
        </div>
        <div className="text-sm font-bold tabular-nums truncate">{value}</div>
        {subtext && (
          <div className="text-[9px] text-slate-500 font-mono truncate">{subtext}</div>
        )}
      </div>
    </motion.div>
  );
}

export function MarketStats() {
  const tickers = useMarketStore((s) => s.tickers);
  const selectedSymbol = useMarketStore((s) => s.selectedSymbol);
  const ticker = tickers[selectedSymbol];

  const allTickers = Object.values(tickers);
  const gainersCount = allTickers.filter((t) => (t.changePercent24h ?? 0) > 0).length;
  const losersCount = allTickers.filter((t) => (t.changePercent24h ?? 0) < 0).length;
  const totalVol = allTickers.reduce((sum, t) => sum + (t.volume24h ?? 0), 0);

  const spread =
    ticker?.high24h && ticker?.low24h
      ? ((ticker.high24h - ticker.low24h) / ticker.low24h * 100).toFixed(2) + "%"
      : "—";

  return (
    <div className="grid grid-cols-2 gap-2">
      <StatCard
        label="Selected Price"
        value={`$${formatPrice(ticker?.price)}`}
        icon={<DollarSign className="w-3.5 h-3.5" />}
        accent="cyan"
        subtext={selectedSymbol}
      />
      <StatCard
        label="24h Spread"
        value={spread}
        icon={<BarChart3 className="w-3.5 h-3.5" />}
        accent="amber"
        subtext={`H: $${formatPrice(ticker?.high24h)} / L: $${formatPrice(ticker?.low24h)}`}
      />
      <StatCard
        label="Gainers"
        value={`${gainersCount}`}
        icon={<TrendingUp className="w-3.5 h-3.5" />}
        accent="emerald"
        subtext={`of ${allTickers.length} tracked`}
      />
      <StatCard
        label="Losers"
        value={`${losersCount}`}
        icon={<TrendingDown className="w-3.5 h-3.5" />}
        accent="rose"
        subtext={`of ${allTickers.length} tracked`}
      />
      <StatCard
        label="Total Volume"
        value={formatVolume(totalVol)}
        icon={<Activity className="w-3.5 h-3.5" />}
        accent="slate"
        subtext="Across all pairs"
      />
      <StatCard
        label="Pairs Tracked"
        value={`${allTickers.length}`}
        icon={<Layers className="w-3.5 h-3.5" />}
        accent="slate"
        subtext="Active instruments"
      />
    </div>
  );
}
