"use client";

import React, { useState } from "react";
import { DEFAULT_SYMBOLS } from "@gorengan/shared";
import { clsx } from "clsx";
import {
  MarketHeaderTicker,
  MarketOverviewTable,
  MarketStats,
  IntelligenceSidebar,
  BottomStickyTickerTape,
  useSymbolsQuery,
  useMarketsQuery,
} from "@/features/markets";
import { TradingViewChart, ChartHeader } from "@/features/chart";
import { WatchlistSidebar } from "@/features/watchlist";
import { useTerminalWebSocket } from "@/hooks/useTerminalWebSocket";
import { useMarketStore } from "@/stores/marketStore";
import { Card, CardContent } from "@/components/ui/card";
import { MobileNavigationBar, type MobileTab } from "@/components/MobileNavigationBar";

export default function TerminalPage() {
  const [mobileTab, setMobileTab] = useState<MobileTab>("chart");
  const { data: symbolsData } = useSymbolsQuery();
  useMarketsQuery();
  const symbols = symbolsData?.symbols || DEFAULT_SYMBOLS;
  const symbolIds = React.useMemo(() => symbols.map((symbol) => symbol.id), [symbols]);
  useTerminalWebSocket(symbolIds, { isThrottled: false });
  const selectedSymbol = useMarketStore((state) => state.selectedSymbol);

  return (
    <main className="terminal-shell">
      <MarketHeaderTicker />
      <div className="terminal-rail">
        <span>GI / TERMINAL</span>
        <strong>{selectedSymbol}</strong>
        <span className="terminal-rail-count">{symbols.length} MARKETS</span>
      </div>

      <div className="terminal-workspace">
        <aside className={clsx("terminal-watchlist-panel", mobileTab === "markets" ? "is-mobile-active" : "")} aria-label="Watchlist and markets">
          <WatchlistSidebar symbols={symbols} onSelectSymbol={() => setMobileTab("chart")} />
        </aside>

        <section className={clsx("terminal-main-panel", mobileTab === "chart" ? "is-mobile-active" : "")} aria-label="Chart and market prices">
          <Card className="terminal-card terminal-chart-card">
            <ChartHeader />
            <div className="terminal-chart-area">
              <TradingViewChart key={selectedSymbol} symbol={selectedSymbol} className="w-full h-full" />
            </div>
          </Card>

          <div className="terminal-mobile-stats">
            <Card className="terminal-card p-3">
              <div className="terminal-card-label">MARKET SNAPSHOT</div>
              <MarketStats />
            </Card>
          </div>

          <Card id="market-overview" className="terminal-card terminal-market-card">
            <div className="terminal-market-heading">
              <div><span>02 / BOARD</span><h2>Markets</h2></div>
              <span>{symbols.length} symbols</span>
            </div>
            <CardContent className="p-0">
              <MarketOverviewTable symbols={symbols} onSelectSymbol={() => setMobileTab("chart")} />
            </CardContent>
          </Card>
        </section>

        <aside className={clsx("terminal-intel-panel", mobileTab === "intel" ? "is-mobile-active" : "")} aria-label="Market statistics and news">
          <IntelligenceSidebar key={mobileTab === "intel" ? "news" : "pulse"} initialTab={mobileTab === "intel" ? "news" : "pulse"} />
        </aside>
      </div>

      <BottomStickyTickerTape />
      <MobileNavigationBar activeTab={mobileTab} onChangeTab={setMobileTab} />
    </main>
  );
}
