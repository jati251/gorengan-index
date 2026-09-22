"use client";

import React, { useState } from "react";
import { DEFAULT_SYMBOLS } from "@gorengan/shared";
import { Zap, BarChart3 } from "lucide-react";
import { clsx } from "clsx";

import { MarketHeaderTicker, MarketOverviewTable, MarketStats } from "@/features/markets";
import { useSymbolsQuery, useMarketsQuery } from "@/features/markets";
import { TradingViewChart, ChartHeader } from "@/features/chart";
import { WatchlistSidebar } from "@/features/watchlist";
import { NewsFeed, SentimentGauge } from "@/features/news";

import { useTerminalWebSocket } from "@/hooks/useTerminalWebSocket";
import { useMarketStore } from "@/stores/marketStore";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { TerminalFooter } from "@/components/TerminalFooter";
import { MobileNavigationBar, type MobileTab } from "@/components/MobileNavigationBar";

export default function TerminalPage() {
  const [mobileTab, setMobileTab] = useState<MobileTab>("chart");

  const { data: symbolsData } = useSymbolsQuery();
  // Hydrate initial market tickers via TanStack Query
  useMarketsQuery();

  const symbols = symbolsData?.symbols || DEFAULT_SYMBOLS;
  const symbolIds = React.useMemo(() => symbols.map((s) => s.id), [symbols]);

  // Connect persistent WebSocket and subscribe to all registered symbols
  useTerminalWebSocket(symbolIds);

  const selectedSymbol = useMarketStore((s) => s.selectedSymbol);

  const handleSelectSymbol = () => {
    // When a symbol is chosen from mobile markets view, switch to chart view
    setMobileTab("chart");
  };

  return (
    <main className="min-h-screen lg:h-screen flex flex-col bg-[#070a12] text-slate-200 lg:overflow-hidden">
      {/* 1. Realtime Marquee & Status Header */}
      <MarketHeaderTicker />

      {/* 2. Main Terminal Content — 3-Column Workstation on Desktop, Tabbed on Mobile */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden min-h-0">
        {/* LEFT: Watchlist Sidebar */}
        <aside
          className={clsx(
            "w-full lg:w-72 xl:w-80 shrink-0 border-b lg:border-b-0 lg:border-r border-slate-800/80 bg-[#0a0e17] flex-col h-[520px] lg:h-full overflow-hidden min-h-0 pb-16 lg:pb-0",
            mobileTab === "markets" ? "flex" : "hidden lg:flex"
          )}
        >
          <WatchlistSidebar
            symbols={symbols}
            onSelectSymbol={handleSelectSymbol}
          />
        </aside>

        {/* CENTER: Interactive Chart & Market Table */}
        <section
          className={clsx(
            "flex-1 flex-col overflow-y-auto p-2.5 sm:p-3 lg:p-4 gap-3 sm:gap-4 min-w-0 pb-20 lg:pb-4",
            mobileTab === "chart"
              ? "flex"
              : mobileTab === "markets"
                ? "flex lg:flex"
                : "hidden lg:flex"
          )}
        >
          {/* Main Candlestick Chart Card — visible in Chart tab and Desktop */}
          <div className={clsx(mobileTab === "chart" ? "block" : "hidden lg:block")}>
            <Card className="flex flex-col shrink-0">
              <ChartHeader />
              <div className="w-full h-[360px] sm:h-[420px] lg:h-[480px] bg-[#090d16]">
                <TradingViewChart
                  key={selectedSymbol}
                  symbol={selectedSymbol}
                  className="w-full h-full"
                />
              </div>
            </Card>
          </div>

          {/* Quick Market Stats on Mobile Chart view */}
          <div className={clsx("lg:hidden", mobileTab === "chart" ? "block" : "hidden")}>
            <Card className="p-3">
              <div className="flex items-center gap-2 mb-2.5">
                <BarChart3 className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300 font-mono">
                  Market Pulse
                </span>
              </div>
              <MarketStats />
            </Card>
          </div>

          {/* Realtime Market Table Card */}
          <Card className="flex-1 min-h-0">
            <CardHeader className="bg-[#0a0e17]/80 shrink-0 py-2.5 sm:py-3">
              <CardTitle className="text-xs sm:text-sm">
                <Zap className="w-3.5 h-3.5 text-emerald-400" />
                Market Overview
              </CardTitle>
              <span className="text-[10px] sm:text-[11px] text-slate-500 font-mono">
                Real-time prices
              </span>
            </CardHeader>
            <CardContent className="p-0">
              <MarketOverviewTable
                symbols={symbols}
                onSelectSymbol={handleSelectSymbol}
              />
            </CardContent>
          </Card>
        </section>

        {/* RIGHT: Intelligence Sidebar — News, Sentiment, Stats */}
        <aside
          className={clsx(
            "w-full lg:w-80 xl:w-[340px] shrink-0 border-t lg:border-t-0 lg:border-l border-slate-800/80 bg-[#0a0e17] flex-col h-auto lg:h-full overflow-hidden min-h-0 pb-20 lg:pb-0",
            mobileTab === "intel" ? "flex" : "hidden lg:flex"
          )}
        >
          {/* Market Stats Panel */}
          <div className="p-3 border-b border-slate-800/60 shrink-0">
            <div className="flex items-center gap-2 mb-2.5">
              <BarChart3 className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300 font-mono">
                Market Pulse
              </span>
            </div>
            <MarketStats />
          </div>

          {/* Sentiment Gauge */}
          <div className="p-3 border-b border-slate-800/60 shrink-0">
            <SentimentGauge />
          </div>

          {/* News Feed — scrollable */}
          <div className="flex-1 overflow-hidden flex flex-col min-h-0">
            <NewsFeed />
          </div>
        </aside>
      </div>

      {/* 3. Mobile Navigation Bottom Bar */}
      <MobileNavigationBar
        activeTab={mobileTab}
        onChangeTab={setMobileTab}
        selectedSymbol={selectedSymbol}
      />

      {/* 4. Minimal Footer (Hidden on mobile to yield space to MobileNavigationBar) */}
      <div className="hidden lg:block">
        <TerminalFooter />
      </div>
    </main>
  );
}
