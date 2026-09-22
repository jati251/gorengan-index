"use client";

import React, { useSyncExternalStore } from "react";
import { Clock } from "lucide-react";

function subscribe(callback: () => void) {
  const interval = setInterval(callback, 1000);
  return () => clearInterval(interval);
}

function getSnapshot() {
  const now = new Date();
  const timeStr = now.toLocaleTimeString([], {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const offsetMin = -now.getTimezoneOffset();
  const sign = offsetMin >= 0 ? "+" : "-";
  const hours = Math.floor(Math.abs(offsetMin) / 60);
  const mins = Math.abs(offsetMin) % 60;
  const tzStr = mins > 0 ? `UTC${sign}${hours}:${mins}` : `UTC${sign}${hours}`;
  return `${timeStr}|${tzStr}`;
}

function getServerSnapshot() {
  return "--:--:--|UTC";
}

export function DeviceClock() {
  const clockValue = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [timeStr, tzStr] = clockValue.split("|");

  return (
    <div className="flex items-center gap-1.5 text-xs font-mono text-slate-300 bg-slate-900/60 px-2 py-0.5 rounded border border-slate-800/80 select-none">
      <Clock className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
      <span className="font-semibold text-slate-100 tabular-nums">{timeStr}</span>
      <span className="text-[10px] text-emerald-400 font-medium px-1 bg-emerald-950/40 rounded border border-emerald-900/40">
        {tzStr}
      </span>
    </div>
  );
}
