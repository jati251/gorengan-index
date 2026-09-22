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
import { useMarketStore } from "@/stores/marketStore";
import { formatPrice, formatVolume } from "@/utils/formatters";
import { formatFxPrice, isFxSymbol, getFxMetadata, formatPips } from "@/features/forex";
import { formatEquityPrice, isUsEquitySymbol, isIdxEquitySymbol } from "@/features/equities";
import type { StatCardProps } from "../types";

function StatCard({ label, value, icon, accent = "slate", subtext }: StatCardProps) {
  const accentClasses = {
    emerald: "text-emerald-400 bg-emerald-500/[0.07] border-emerald-500/30 shadow-[0_4px_20px_rgba(16,185,129,0.08)]",
    rose: "text-rose-400 bg-rose-500/[0.07] border-rose-500/30 shadow-[0_4px_20px_rgba(244,63,94,0.08)]",
    cyan: "text-cyan-400 bg-cyan-500/[0.07] border-cyan-500/30 shadow-[0_4px_20px_rgba(6,182,212,0.08)]",
    amber: "text-amber-400 bg-amber-500/[0.07] border-amber-500/30 shadow-[0_4px_20px_rgba(245,158,11,0.08)]",
    slate: "text-slate-200 bg-white/[0.03] border-white/[0.08] shadow-[0_4px_20px_rgba(0,0,0,0.25)]",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -1 }}
      transition={{ duration: 0.15 }}
      className={clsx(
        "flex items-center gap-2.5 px-3 py-2.5 rounded-xl border backdrop-blur-md font-mono transition-all relative overflow-hidden group",
        accentClasses[accent]
      )}
    >
      <div className="shrink-0 opacity-80 group-hover:opacity-100 transition-opacity">{icon}</div>
      <div className="min-w-0 flex-1">
        <div className="text-[9px] uppercase tracking-wider text-slate-400 font-semibold truncate">
          {label}
        </div>
        <div className="text-sm font-bold tabular-nums truncate text-white drop-shadow-xs">{value}</div>
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
  const priceDirections = useMarketStore((s) => s.priceDirections);
  const direction = priceDirections[selectedSymbol] || "neutral";
  const ticker = tickers[selectedSymbol];

  const isFx = isFxSymbol(selectedSymbol);
  const fxMeta = getFxMetadata(selectedSymbol);
  const isUs = isUsEquitySymbol(selectedSymbol);
  const isId = isIdxEquitySymbol(selectedSymbol);

  const allTickers = Object.values(tickers);
  const gainersCount = allTickers.filter((t) => (t.changePercent24h ?? 0) > 0).length;
  const losersCount = allTickers.filter((t) => (t.changePercent24h ?? 0) < 0).length;
  const totalVol = allTickers.reduce((sum, t) => sum + (t.volume24h ?? 0), 0);

  const totalActive = gainersCount + losersCount;
  const gainersPercent = totalActive > 0 ? Math.round((gainersCount / totalActive) * 100) : 50;
  const losersPercent = 100 - gainersPercent;

  const priceFormatted = isFx
    ? formatFxPrice(ticker?.price, selectedSymbol, fxMeta?.displayDecimals)
    : isId
      ? formatEquityPrice(ticker?.price, selectedSymbol, "IDR")
      : isUs
        ? formatEquityPrice(ticker?.price, selectedSymbol, "USD")
        : `$${formatPrice(ticker?.price)}`;

  const highFormatted = isFx
    ? formatFxPrice(ticker?.high24h, selectedSymbol, fxMeta?.displayDecimals)
    : isId
      ? formatEquityPrice(ticker?.high24h, selectedSymbol, "IDR")
      : isUs
        ? formatEquityPrice(ticker?.high24h, selectedSymbol, "USD")
        : `$${formatPrice(ticker?.high24h)}`;

  const lowFormatted = isFx
    ? formatFxPrice(ticker?.low24h, selectedSymbol, fxMeta?.displayDecimals)
    : isId
      ? formatEquityPrice(ticker?.low24h, selectedSymbol, "IDR")
      : isUs
        ? formatEquityPrice(ticker?.low24h, selectedSymbol, "USD")
        : `$${formatPrice(ticker?.low24h)}`;

  const spreadVal = isFx
    ? ticker?.spreadPips != null
      ? `${ticker.spreadPips} pip`
      : formatPips(ticker?.spread, fxMeta?.pipSize ?? 0.0001)
    : ticker?.high24h && ticker?.low24h
      ? ((ticker.high24h - ticker.low24h) / ticker.low24h * 100).toFixed(2) + "%"
      : "—";

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <StatCard
          label="Selected Price"
          value={priceFormatted}
          icon={<DollarSign className="w-3.5 h-3.5" />}
          accent={direction === "up" ? "emerald" : direction === "down" ? "rose" : "cyan"}
          subtext={selectedSymbol}
        />
        <StatCard
          label={isFx ? "Spread (Pips)" : "24h Spread"}
          value={spreadVal}
          icon={<BarChart3 className="w-3.5 h-3.5" />}
          accent="amber"
          subtext={`H: ${highFormatted} / L: ${lowFormatted}`}
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
          label={isFx ? "Active Venue" : "Total Volume"}
          value={isFx ? "Interbank" : formatVolume(totalVol)}
          icon={<Activity className="w-3.5 h-3.5" />}
          accent="slate"
          subtext={isFx ? "Venues streaming" : "Across crypto pairs"}
        />
        <StatCard
          label="Pairs Tracked"
          value={`${allTickers.length}`}
          icon={<Layers className="w-3.5 h-3.5" />}
          accent="slate"
          subtext="Active instruments"
        />
      </div>

      {/* Interactive Market Breadth (Bulls vs Bears) Visual Bar */}
      <div className="p-2.5 rounded-xl bg-white/[0.025] border border-white/[0.07] backdrop-blur-md font-mono">
        <div className="flex items-center justify-between text-[10px] font-semibold text-slate-300 mb-1.5">
          <span className="flex items-center gap-1 text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(16,185,129,0.8)]" />
            Bulls {gainersPercent}% ({gainersCount})
          </span>
          <span className="text-[9px] uppercase tracking-wider text-slate-500">Market Breadth</span>
          <span className="flex items-center gap-1 text-rose-400">
            ({losersCount}) {losersPercent}% Bears
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400 shadow-[0_0_6px_rgba(244,63,94,0.8)]" />
          </span>
        </div>
        <div className="w-full h-2 rounded-full overflow-hidden bg-black/40 flex border border-white/[0.06] shadow-inner p-0.5">
          <motion.div
            className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-l-full shadow-[0_0_8px_rgba(16,185,129,0.4)]"
            animate={{ width: `${gainersPercent}%` }}
            transition={{ type: "spring", stiffness: 200, damping: 25 }}
          />
          <motion.div
            className="h-full bg-gradient-to-r from-rose-400 to-rose-500 rounded-r-full shadow-[0_0_8px_rgba(244,63,94,0.4)]"
            animate={{ width: `${losersPercent}%` }}
            transition={{ type: "spring", stiffness: 200, damping: 25 }}
          />
        </div>
      </div>
    </div>
  );
}
