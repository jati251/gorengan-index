"use client";

import React from "react";

interface MarketNewsWidgetProps {
  headlines: { title: string; link: string; pubDate: string }[];
}

export default function MarketNewsWidget({ headlines }: MarketNewsWidgetProps) {
  return (
    <div className="bg-black border border-zinc-800 p-4 rounded-md shadow-lg flex flex-col h-72">
      <h3 className="text-zinc-500 font-mono text-xs mb-3 flex justify-between items-center shrink-0 border-b border-zinc-800 pb-2">
        <span className="flex items-center gap-2">
          <span className="text-white bg-zinc-800 px-2 py-0.5 rounded-sm">NEWS</span>
          MARKET FEED
        </span>
        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
      </h3>

      <div className="overflow-auto grow custom-scrollbar pr-2">
        {headlines && headlines.length > 0 ? (
          <div className="flex flex-col">
            {headlines.map((headline, idx) => {
              // Parse pubDate to get just the HH:MM
              let timeStr = "";
              try {
                const date = new Date(headline.pubDate);
                timeStr = date.toLocaleTimeString("en-GB", { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' });
              } catch(e) {
                timeStr = "--:--";
              }
              
              return (
                <a
                  key={idx}
                  href={headline.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex gap-3 py-1.5 border-b border-zinc-900/50 hover:bg-zinc-900/50 transition-colors"
                >
                  <span className="text-zinc-500 text-[10px] whitespace-nowrap mt-0.5">{timeStr}</span>
                  <span className="text-xs text-zinc-300 group-hover:text-yellow-400 font-medium leading-relaxed">
                    {headline.title}
                  </span>
                </a>
              );
            })}
          </div>
        ) : (
          <div className="text-zinc-600 text-xs font-mono flex items-center justify-center h-full">
            No signal detected...
          </div>
        )}
      </div>
    </div>
  );
}
