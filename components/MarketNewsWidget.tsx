"use client";

import React from "react";

interface MarketNewsWidgetProps {
  headlines: string[];
}

export default function MarketNewsWidget({ headlines }: MarketNewsWidgetProps) {
  return (
    <div className="bg-black border border-zinc-800 p-4 rounded-md shadow-lg flex flex-col h-64">
      <h3 className="text-zinc-500 font-mono text-xs mb-4 flex justify-between items-center shrink-0">
        <span>MARKET FEED</span>
        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
      </h3>

      <div className="overflow-auto grow custom-scrollbar pr-2">
        {headlines && headlines.length > 0 ? (
          <ul className="flex flex-col gap-3">
            {headlines.map((headline, idx) => (
              <li
                key={idx}
                className="border-b border-zinc-900 pb-2 last:border-0 last:pb-0"
              >
                <p className="text-xs font-mono text-zinc-300 hover:text-yellow-400 transition-colors cursor-default">
                  <span className="text-zinc-600 mr-2">{">"}</span>
                  {headline}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <div className="text-zinc-600 text-xs font-mono flex items-center justify-center h-full">
            No signal detected...
          </div>
        )}
      </div>
    </div>
  );
}
