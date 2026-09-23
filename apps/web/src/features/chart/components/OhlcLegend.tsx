"use client";

import React from "react";
import { formatPrice, formatPercent, formatVolume } from "@/utils/formatters";
import { formatFxPrice, isFxSymbol } from "@/features/forex";
import type { Time } from "lightweight-charts";

export interface OhlcData {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  time: Time;
}

interface OhlcLegendProps {
  data: OhlcData;
  symbol: string;
  timeframe: string;
  showEma20: boolean;
  showEma50: boolean;
  showVolume: boolean;
}

export function OhlcLegend({
  data,
  symbol,
  timeframe,
  showEma20,
  showEma50,
  showVolume,
}: OhlcLegendProps) {
  const isUp = data.close >= data.open;
  const changePercent =
    data.open > 0 ? ((data.close - data.open) / data.open) * 100 : 0;

  const isFx = isFxSymbol(symbol);

  const formatVal = (val: number) => {
    return isFx ? formatFxPrice(val, symbol) : `$${formatPrice(val)}`;
  };

  return (
    <div className="absolute top-2 left-3 z-20 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] pointer-events-none bg-[#2a2839]/85 backdrop-blur-xs px-2.5 py-1 rounded border border-slate-800/60 shadow-lg">
      <div className="flex items-center gap-1.5 font-bold text-slate-200">
        <span>{symbol}</span>
        <span className="text-slate-500 font-normal">[{timeframe}]</span>
        {isFx && (
          <span className="text-[9px] text-cyan-400 font-semibold px-1 py-0.2 rounded bg-cyan-950/60 border border-cyan-800/40">
            MID
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <span className="text-slate-500">O</span>
        <span className="text-slate-200 font-medium">{formatVal(data.open)}</span>

        <span className="text-slate-500">H</span>
        <span className="text-emerald-400 font-medium">{formatVal(data.high)}</span>

        <span className="text-slate-500">L</span>
        <span className="text-rose-400 font-medium">{formatVal(data.low)}</span>

        <span className="text-slate-500">C</span>
        <span className={isUp ? "text-emerald-400 font-semibold" : "text-rose-400 font-semibold"}>
          {formatVal(data.close)}
        </span>

        {!isFx && (
          <>
            <span className="text-slate-500">Vol</span>
            <span className="text-slate-300 font-medium">{formatVolume(data.volume)}</span>
          </>
        )}

        <span
          className={`font-semibold px-1 rounded text-[10px] ${
            isUp ? "bg-emerald-950/80 text-emerald-400" : "bg-rose-950/80 text-rose-400"
          }`}
        >
          {formatPercent(changePercent)}
        </span>
      </div>

      {/* Active Indicator tags in Legend */}
      <div className="hidden sm:flex items-center gap-2 border-l border-slate-800/80 pl-2">
        {showEma20 && <span className="text-[#26a6ac] font-medium text-[10px]">EMA(20)</span>}
        {showEma50 && <span className="text-[#f4c41b] font-medium text-[10px]">EMA(50)</span>}
        {!isFx && showVolume && <span className="text-slate-400 font-medium text-[10px]">VOL</span>}
      </div>
    </div>
  );
}
