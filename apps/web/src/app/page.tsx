"use client";

import React from "react";
import { DEFAULT_SYMBOLS } from "@gorengan/shared";
import { MarketHeaderTicker, MarketOverviewTable, MarketStats } from "../features/markets/index";
import { useSymbolsQuery, useMarketsQuery } from "../features/markets/index";
import { TradingViewChart, ChartHeader } from "../features/chart/index";
import { WatchlistSidebar } from "../features/watchlist/index";
import { NewsFeed, SentimentGauge } from "../features/news/index";
import { useTerminalWebSocket } from "../hooks/useTerminalWebSocket";
import { useMarketStore } from "../stores/marketStore";
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/card";
import { Zap, BarChart3 } from "lucide-react";

export default function TerminalPage() {
  const { data: symbolsData } = useSymbolsQuery();
  // Hydrate initial market tickers via TanStack Query
  useMarketsQuery();

  const symbols = symbolsData?.symbols || DEFAULT_SYMBOLS;
  const symbolIds = React.useMemo(() => symbols.map((s) => s.id), [symbols]);

  // Connect persistent WebSocket and subscribe to all registered symbols
  useTerminalWebSocket(symbolIds);

  const selectedSymbol = useMarketStore((s) => s.selectedSymbol);
  const status = useMarketStore((s) => s.providerStatus);

  return (
    <main className="min-h-screen flex flex-col bg-[#070a12] text-slate-200">
      {/* 1. Realtime Marquee & Status Header */}
      <MarketHeaderTicker />

      {/* 2. Main Terminal Content — 3-Column Grid */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* LEFT: Watchlist Sidebar */}
        <aside className="w-full lg:w-72 xl:w-80 shrink-0 border-b lg:border-b-0 lg:border-r border-slate-800/80 bg-[#0a0e17]">
          <WatchlistSidebar symbols={symbols} />
        </aside>

        {/* CENTER: Interactive Chart & Market Table */}
        <section className="flex-1 flex flex-col overflow-y-auto p-3 lg:p-4 gap-4 min-w-0">
          {/* Main Candlestick Chart Card */}
          <Card className="flex flex-col shrink-0">
            <ChartHeader />
            <div className="w-full h-[420px] lg:h-[480px] bg-[#090d16]">
              <TradingViewChart
                key={selectedSymbol}
                symbol={selectedSymbol}
                className="w-full h-full"
              />
            </div>
          </Card>

          {/* Realtime Market Table Card */}
          <Card className="flex-1 min-h-0">
            <CardHeader className="bg-[#0a0e17]/80">
              <CardTitle>
                <Zap className="w-4 h-4 text-emerald-400" />
                Market Overview
              </CardTitle>
              <span className="text-[11px] text-slate-500 font-mono">
                Real-time prices
              </span>
            </CardHeader>
            <CardContent className="p-0">
              <MarketOverviewTable symbols={symbols} />
            </CardContent>
          </Card>
        </section>

        {/* RIGHT: Intelligence Sidebar — News, Sentiment, Stats */}
        <aside className="w-full lg:w-80 xl:w-[340px] shrink-0 border-t lg:border-t-0 lg:border-l border-slate-800/80 bg-[#0a0e17] flex flex-col overflow-hidden">
          {/* Market Stats Panel */}
          <div className="p-3 border-b border-slate-800/60">
            <div className="flex items-center gap-2 mb-2.5">
              <BarChart3 className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300 font-mono">
                Market Pulse
              </span>
            </div>
            <MarketStats />
          </div>

          {/* Sentiment Gauge */}
          <div className="p-3 border-b border-slate-800/60">
            <SentimentGauge />
          </div>

          {/* News Feed — scrollable */}
          <div className="flex-1 overflow-hidden flex flex-col min-h-0">
            <NewsFeed />
          </div>
        </aside>
      </div>

      {/* 3. Minimal Footer */}
      <footer className="border-t border-slate-800 bg-[#060810] px-4 py-2 text-[11px] font-mono text-slate-400 flex items-center justify-between gap-3 select-none">
        <span className="text-slate-500">Gorengan Terminal</span>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5">
            <span className={status === "LIVE" ? "w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" : "w-1.5 h-1.5 rounded-full bg-slate-500 inline-block"} />
            <span className="text-slate-400">{status}</span>
          </span>
        </div>
      </footer>
    </main>
  );
}
