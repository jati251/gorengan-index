"use client";

import React from "react";
import { RegionalIndex } from "@/data/gorenganData";

export default function TopMoversWidget({ regions }: { regions: RegionalIndex[] }) {
  // Simulate daily changes for visual effect since API doesn't provide historical changes
  // Hash the string to get a deterministic "random" change between -15 and +15
  const getChange = (str: string) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
    const dateSalt = new Date().getDate(); // Changes every day
    return (((hash + dateSalt) % 300) / 10) - 15; 
  };

  const movers = regions.map(r => ({
    ...r,
    change: getChange(r.region)
  })).sort((a, b) => Math.abs(b.change) - Math.abs(a.change)).slice(0, 5);

  return (
    <div className="bg-black border border-zinc-800 p-4 rounded-md shadow-lg flex flex-col font-mono text-xs">
      <h3 className="text-zinc-500 mb-3 flex items-center gap-2 border-b border-zinc-800 pb-2">
        <span className="text-white bg-zinc-800 px-2 py-0.5 rounded-sm">MVR</span>
        TOP MOVERS (24H)
      </h3>

      <div className="flex flex-col gap-2">
        {movers.map((mover, idx) => {
          const isPositive = mover.change >= 0;
          return (
            <div key={idx} className="flex justify-between items-center border-b border-zinc-900/50 pb-1 last:border-0">
              <span className="text-zinc-300">{mover.region}</span>
              <div className="flex items-center gap-3">
                <span className="text-zinc-500">Rp {mover.bakwanPrice.toLocaleString("id-ID")}</span>
                <span className={`w-16 text-right font-medium ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
                  {isPositive ? '+' : ''}{mover.change.toFixed(1)}%
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
