"use client";

import React from "react";
import { RegionalIndex } from "@/data/gorenganData";

export default function TopMoversWidget({ regions }: { regions: RegionalIndex[] }) {
  // Generate deterministic daily changes using a seeded hash
  const getChange = (str: string, idx: number) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
    const dateSalt = new Date().getDate();
    const hourSalt = new Date().getHours();
    const raw = (((hash + dateSalt + hourSalt * (idx + 1)) % 200) / 10) - 10;
    return raw;
  };

  const movers = regions.map((r, idx) => ({
    ...r,
    change: getChange(r.region, idx)
  }));

  // Split into gainers and losers
  const gainers = movers.filter(m => m.change > 0).sort((a, b) => b.change - a.change).slice(0, 3);
  const losers = movers.filter(m => m.change < 0).sort((a, b) => a.change - b.change).slice(0, 3);

  return (
    <div className="bg-black border border-zinc-800 p-4 rounded-md shadow-lg flex flex-col font-mono text-xs">
      <h3 className="text-zinc-500 mb-3 flex items-center gap-2 border-b border-zinc-800 pb-2">
        <span className="text-white bg-zinc-800 px-2 py-0.5 rounded-sm">MVR</span>
        TOP MOVERS (24H)
      </h3>

      {/* Gainers */}
      {gainers.length > 0 && (
        <div className="mb-3">
          <div className="text-green-600 text-[10px] mb-1.5">▲ GAINERS</div>
          <div className="flex flex-col gap-1.5">
            {gainers.map((m, idx) => (
              <div key={`g-${idx}`} className="flex justify-between items-center">
                <span className="text-zinc-300 truncate mr-2">{m.region}</span>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-zinc-500">Rp {m.bakwanPrice.toLocaleString("id-ID")}</span>
                  <span className="text-green-500 w-14 text-right font-medium">+{m.change.toFixed(1)}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Losers */}
      {losers.length > 0 && (
        <div>
          <div className="text-red-600 text-[10px] mb-1.5">▼ LOSERS</div>
          <div className="flex flex-col gap-1.5">
            {losers.map((m, idx) => (
              <div key={`l-${idx}`} className="flex justify-between items-center">
                <span className="text-zinc-300 truncate mr-2">{m.region}</span>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-zinc-500">Rp {m.bakwanPrice.toLocaleString("id-ID")}</span>
                  <span className="text-red-500 w-14 text-right font-medium">{m.change.toFixed(1)}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
