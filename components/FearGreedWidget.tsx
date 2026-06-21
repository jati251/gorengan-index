"use client";

import React, { useEffect, useState } from "react";

export default function FearGreedWidget({ sentiment, volatility }: { sentiment: string, volatility: number }) {
  const [index, setIndex] = useState(50);
  
  useEffect(() => {
    // Calculate a fake fear & greed index 0-100
    // 0 = Extreme Fear (Bearish, High Volatility)
    // 100 = Extreme Greed (Bullish, Low Volatility)
    let base = 50;
    if (sentiment === "BULLISH" || sentiment === "EXTREME_BULLISH") base += 25;
    if (sentiment === "BEARISH") base -= 25;
    
    // Add noise based on volatility
    const noise = Math.floor(volatility * 1000); // volatility is tiny, scale it up
    
    // Smooth transition
    const target = Math.max(0, Math.min(100, base + noise));
    setIndex(target);
  }, [sentiment, volatility]);

  let statusText = "NEUTRAL";
  let statusColor = "text-yellow-400";
  if (index >= 75) { statusText = "EXTREME GREED"; statusColor = "text-green-500"; }
  else if (index >= 55) { statusText = "GREED"; statusColor = "text-green-400"; }
  else if (index <= 25) { statusText = "EXTREME FEAR"; statusColor = "text-red-500"; }
  else if (index <= 45) { statusText = "FEAR"; statusColor = "text-red-400"; }

  return (
    <div className="bg-black border border-zinc-800 p-4 rounded-md shadow-lg flex flex-col">
      <h3 className="text-zinc-500 font-mono text-xs mb-3 flex items-center gap-2 border-b border-zinc-800 pb-2">
        <span className="text-white bg-zinc-800 px-2 py-0.5 rounded-sm">IDX</span>
        FEAR & GREED
      </h3>
      
      <div className="flex flex-col gap-2 pt-2">
        <div className="flex justify-between items-end">
          <span className={`text-3xl font-bold font-mono ${statusColor}`}>{index}</span>
          <span className={`text-sm font-mono ${statusColor} mb-1`}>{statusText}</span>
        </div>
        
        <div className="w-full h-2 bg-zinc-900 rounded overflow-hidden flex">
          <div className="h-full bg-red-500 transition-all duration-1000" style={{ width: `${Math.min(100, Math.max(0, 50 - index))}%` }} />
          <div className="h-full bg-zinc-700 w-0.5" />
          <div className="h-full bg-green-500 transition-all duration-1000" style={{ width: `${Math.max(0, index - 50)}%` }} />
        </div>
        
        <div className="flex justify-between text-[10px] text-zinc-600 font-mono mt-1">
          <span>0 (FEAR)</span>
          <span>50</span>
          <span>100 (GREED)</span>
        </div>
      </div>
    </div>
  );
}
