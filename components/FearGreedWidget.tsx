"use client";

import React, { useEffect, useState } from "react";

export default function FearGreedWidget({ sentiment, volatility }: { sentiment: string, volatility: number }) {
  const [index, setIndex] = useState(50);
  
  useEffect(() => {
    let base = 50;
    if (sentiment === "BULLISH" || sentiment === "EXTREME_BULLISH") base += 25;
    if (sentiment === "BEARISH") base -= 25;
    
    const noise = Math.floor(volatility * 1000);
    const target = Math.max(0, Math.min(100, base + noise));
    setIndex(target);
  }, [sentiment, volatility]);

  let statusText = "NEUTRAL";
  let statusColor = "text-yellow-400";
  let dotColor = "bg-yellow-400";
  if (index >= 75) { statusText = "EXTREME GREED"; statusColor = "text-green-500"; dotColor = "bg-green-500"; }
  else if (index >= 55) { statusText = "GREED"; statusColor = "text-green-400"; dotColor = "bg-green-400"; }
  else if (index <= 25) { statusText = "EXTREME FEAR"; statusColor = "text-red-500"; dotColor = "bg-red-500"; }
  else if (index <= 45) { statusText = "FEAR"; statusColor = "text-red-400"; dotColor = "bg-red-400"; }

  return (
    <div className="bg-black border border-zinc-800 p-4 rounded-md shadow-lg flex flex-col">
      <h3 className="text-zinc-500 font-mono text-xs mb-3 flex items-center gap-2 border-b border-zinc-800 pb-2">
        <span className="text-white bg-zinc-800 px-2 py-0.5 rounded-sm">IDX</span>
        FEAR & GREED
      </h3>
      
      <div className="flex flex-col gap-3 pt-2">
        <div className="flex justify-between items-end">
          <span className={`text-3xl font-bold font-mono ${statusColor}`}>{index}</span>
          <span className={`text-sm font-mono ${statusColor} mb-1`}>{statusText}</span>
        </div>
        
        {/* Full-width gradient gauge */}
        <div className="relative w-full h-3 rounded-full overflow-hidden" style={{ background: "linear-gradient(to right, #ef4444, #f97316, #eab308, #84cc16, #22c55e)" }}>
          {/* Needle / Position indicator */}
          <div 
            className="absolute top-0 h-full w-1 bg-white shadow-[0_0_6px_rgba(255,255,255,0.8)] transition-all duration-1000 ease-out"
            style={{ left: `${index}%` }}
          />
        </div>
        
        <div className="flex justify-between text-[10px] text-zinc-600 font-mono">
          <span>EXTREME FEAR</span>
          <span>NEUTRAL</span>
          <span>EXTREME GREED</span>
        </div>
      </div>
    </div>
  );
}
