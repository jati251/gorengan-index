"use client";

import React from "react";
import { DEFAULT_SYMBOLS } from "@gorengan/shared";
import { MarketHeaderTicker, MarketOverviewTable } from "../features/markets/index";
import { useSymbolsQuery, useMarketsQuery } from "../features/markets/index";
import { TradingViewChart, ChartHeader } from "../features/chart/index";
import { WatchlistSidebar } from "../features/watchlist/index";
import { useTerminalWebSocket } from "../hooks/useTerminalWebSocket";
import { useMarketStore } from "../stores/marketStore";
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/card";
import { Database, Zap, Cpu } from "lucide-react";

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

      {/* 2. Main Terminal Content Grid */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Left: Watchlist Sidebar */}
        <aside className="w-full md:w-80 shrink-0 border-b md:border-b-0 md:border-r border-slate-800/80 bg-[#0a0e17]">
          <WatchlistSidebar symbols={symbols} />
        </aside>

        {/* Center/Right: Interactive Chart & Realtime Market Table */}
        <section className="flex-1 flex flex-col overflow-y-auto p-3 lg:p-4 gap-4">
          {/* Main Candlestick Chart Card */}
          <Card className="flex flex-col shrink-0">
            <ChartHeader />
            <div className="w-full h-[420px] bg-[#090d16]">
              <TradingViewChart
                key={selectedSymbol}
                symbol={selectedSymbol}
                className="w-full h-full"
              />
            </div>
          </Card>

          {/* Realtime Market Table Card */}
          <Card className="flex-1">
            <CardHeader className="bg-[#0a0e17]/80">
              <CardTitle>
                <Zap className="w-4 h-4 text-emerald-400" />
                Live Ingestion Stream // Multi-Symbol Overview
              </CardTitle>
              <span className="text-[11px] text-slate-500 font-mono">
                AUTO-SYNCHRONIZED RAM TICKERS
              </span>
            </CardHeader>
            <CardContent className="p-0">
              <MarketOverviewTable symbols={symbols} />
            </CardContent>
          </Card>
        </section>
      </div>

      {/* 3. Terminal Diagnostics Footer */}
      <footer className="border-t border-slate-800 bg-[#060810] px-4 py-2 text-[11px] font-mono text-slate-400 flex flex-wrap items-center justify-between gap-3 select-none">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <Cpu className="w-3.5 h-3.5 text-emerald-400" />
            <span>ENGINE: IN-MEMORY RAM // 1M CANDLE ROLLOVER</span>
          </div>

          <div className="flex items-center gap-1.5 border-l border-slate-800 pl-4">
            <Database className="w-3.5 h-3.5 text-blue-400" />
            <span>STORAGE: SQLITE (WAL) // DURABLE OHLCV</span>
          </div>

          <div className="hidden sm:flex items-center gap-1.5 border-l border-slate-800 pl-4">
            <Zap className="w-3.5 h-3.5 text-yellow-400" />
            <span>INGESTION: BINANCE WEBSOCKET DIRECT</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-slate-400">
            WS GATEWAY: <span className="text-emerald-400 font-semibold">{status}</span>
          </span>
          <span className="text-slate-400">|</span>
          <span className="text-slate-300">ZERO SAAS QUOTA</span>
        </div>
      </footer>
    </main>
  );
}
