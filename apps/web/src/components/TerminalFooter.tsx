"use client";

import React from "react";
import { useMarketStore } from "@/stores/marketStore";

export function TerminalFooter() {
  const status = useMarketStore((s) => s.providerStatus);

  return (
    <footer className="border-t border-slate-800 bg-[#2a2839] px-4 py-2 text-[11px] font-mono text-slate-400 flex items-center justify-between gap-3 select-none">
      <span className="text-slate-500">Gorengan Terminal</span>
      <div className="flex items-center gap-3">
        <span className="flex items-center gap-1.5">
          <span className={status === "LIVE" ? "w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" : "w-1.5 h-1.5 rounded-full bg-slate-500 inline-block"} />
          <span className="text-slate-400">{status}</span>
        </span>
      </div>
    </footer>
  );
}
