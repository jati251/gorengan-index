"use client";

import React, { useEffect, useState } from "react";

interface FutureContract {
  asset: string;
  term: string;
  price: number;
  yieldPct: number;
}

export default function FuturesYieldWidget({ currentPrice }: { currentPrice: number }) {
  const [contracts, setContracts] = useState<FutureContract[]>([]);

  useEffect(() => {
    // Generate forward curve
    const c: FutureContract[] = [
      { asset: "BAKWAN", term: "1-Mo", price: currentPrice * 1.02, yieldPct: 2.0 },
      { asset: "BAKWAN", term: "3-Mo", price: currentPrice * 1.05, yieldPct: 5.0 },
      { asset: "BAKWAN", term: "6-Mo", price: currentPrice * 1.12, yieldPct: 12.0 },
      { asset: "TAHU", term: "1-Mo", price: currentPrice * 0.95 * 1.01, yieldPct: 1.0 },
      { asset: "TEMPE", term: "1-Mo", price: currentPrice * 1.2 * 1.03, yieldPct: 3.0 },
    ];
    setContracts(c);
  }, [currentPrice]);

  return (
    <div className="bg-black border border-zinc-800 p-4 rounded-md shadow-lg flex flex-col font-mono text-xs">
      <h3 className="text-zinc-500 mb-3 flex items-center gap-2 border-b border-zinc-800 pb-2">
        <span className="text-white bg-zinc-800 px-2 py-0.5 rounded-sm">YLD</span>
        FORWARD CURVE & FUTURES
      </h3>

      <div className="flex justify-between text-zinc-600 mb-2 border-b border-zinc-900 pb-1">
        <span className="w-16">CONTRACT</span>
        <span className="w-12">TERM</span>
        <span className="w-16 text-right">FWD PX</span>
        <span className="w-16 text-right">YIELD</span>
      </div>

      <div className="flex flex-col gap-2">
        {contracts.map((c, idx) => (
          <div key={idx} className="flex justify-between items-center group cursor-crosshair hover:bg-zinc-900/50">
            <span className="text-zinc-300 w-16">{c.asset}</span>
            <span className="text-zinc-500 w-12">{c.term}</span>
            <span className="text-yellow-400 w-16 text-right">{Math.round(c.price).toLocaleString("id-ID")}</span>
            <span className={`w-16 text-right ${c.yieldPct > 0 ? 'text-green-500' : 'text-red-500'}`}>
              +{c.yieldPct.toFixed(1)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
