"use client";

import React from "react";
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
    emerald: "text-emerald-300 bg-[#3c3f5f] border-[#3978a8]",
    rose: "text-rose-300 bg-[#3c3f5f] border-[#613e7b]",
    cyan: "text-[#c3e6eb] bg-[#3c3f5f] border-[#3978a8]",
    amber: "text-amber-300 bg-[#3c3f5f] border-[#c66616]",
    slate: "text-slate-200 bg-[#3c3f5f] border-[#55607e]",
  };

  return (
    <div className={clsx("flex items-center gap-2 px-2.5 py-2 border font-mono min-w-0", accentClasses[accent])}>
      <div className="shrink-0">{icon}</div>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] uppercase tracking-wide text-slate-300 font-semibold truncate">
          {label}
        </div>
        <div className="text-base font-bold tabular-nums truncate text-white">{value}</div>
        {subtext && (
          <div className="text-[10px] text-slate-400 font-mono truncate">{subtext}</div>
        )}
      </div>
    </div>
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
  const gainersPercent = totalActive > 0 ? Math.round((gainersCount / totalActive) * 100) : 0;
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

      <div className="border border-[#55607e] bg-[#3c3f5f] p-2.5 font-mono">
        <div className="flex items-center justify-between gap-2 text-xs text-slate-200 mb-2">
          <span>Market breadth</span>
          <span>{totalActive > 0 ? `${gainersCount} up / ${losersCount} down` : "Waiting for prices"}</span>
        </div>
        {totalActive > 0 && <div className="flex h-2 bg-[#2a2839]" role="img" aria-label={`${gainersPercent}% gainers, ${losersPercent}% losers`}>
          <div className="h-full bg-emerald-400" style={{ width: `${gainersPercent}%` }} />
          <div className="h-full bg-rose-400" style={{ width: `${losersPercent}%` }} />
        </div>}
      </div>
    </div>
  );
}
