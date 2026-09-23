"use client";

import React, { useState, useSyncExternalStore } from "react";
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
import { useTranslation } from "@/features/i18n";

const compactQuery = "(max-width: 1279px)";
const subscribeCompact = (callback: () => void) => {
  const query = window.matchMedia(compactQuery);
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
};
const getCompact = () => window.matchMedia(compactQuery).matches;
const getServerCompact = () => true;

export default function TerminalPage() {
  const { dict, interpolate } = useTranslation();
  const [mobileTab, setMobileTab] = useState<MobileTab>("chart");
  const isCompact = useSyncExternalStore(subscribeCompact, getCompact, getServerCompact);
  const { data: symbolsData } = useSymbolsQuery();
  useMarketsQuery();
  const serverSymbols = symbolsData?.symbols;
  const symbols = React.useMemo(() => {
    if (!serverSymbols || serverSymbols.length === 0) {
      return DEFAULT_SYMBOLS;
    }
    const serverMap = new Map(serverSymbols.map((s) => [s.id, s]));
    const merged = [...serverSymbols];
    for (const defaultSym of DEFAULT_SYMBOLS) {
      if (!serverMap.has(defaultSym.id)) {
        merged.push(defaultSym);
      }
    }
    return merged;
  }, [serverSymbols]);
  const symbolIds = React.useMemo(() => symbols.map((symbol) => symbol.id), [symbols]);
  useTerminalWebSocket(symbolIds, { isThrottled: true, throttleMs: isCompact ? 250 : 100 });
  const selectedSymbol = useMarketStore((state) => state.selectedSymbol);
  const selectedCategory = useMarketStore((state) => state.selectedCategory);

  return (
    <main className="terminal-shell">
      <MarketHeaderTicker />
      <div className="terminal-rail">
        <span>{dict.terminal.railTitle}</span>
        <strong>{selectedSymbol}</strong>
        <span className="terminal-rail-count">
          {interpolate(dict.terminal.marketsCount, { count: symbols.length })}
        </span>
      </div>

      <div className="terminal-workspace">
        <aside className={clsx("terminal-watchlist-panel", mobileTab === "markets" ? "is-mobile-active" : "")} aria-label="Watchlist and markets">
          {(!isCompact || mobileTab === "markets") && (
            <WatchlistSidebar
              key={selectedCategory}
              symbols={symbols}
              onSelectSymbol={() => setMobileTab("chart")}
            />
          )}
        </aside>

        <section className={clsx("terminal-main-panel", mobileTab === "chart" ? "is-mobile-active" : "")} aria-label="Chart and market prices">
          {(!isCompact || mobileTab === "chart") && (
            <>
              <Card className="terminal-card terminal-chart-card">
                <ChartHeader />
                <div className="terminal-chart-area">
                  <TradingViewChart key={selectedSymbol} symbol={selectedSymbol} className="w-full h-full" />
                </div>
              </Card>

              <div className="terminal-mobile-stats">
                <Card className="terminal-card p-3">
                  <div className="terminal-card-label">{dict.terminal.workspace.marketSnapshot}</div>
                  <MarketStats />
                </Card>
              </div>

              <Card id="market-overview" className="terminal-card terminal-market-card">
                <div className="terminal-market-heading">
                  <div>
                    <span>{dict.terminal.workspace.boardLabel}</span>
                    <h2>{dict.terminal.workspace.marketsHeading}</h2>
                  </div>
                  <span>{interpolate(dict.terminal.workspace.symbolsCount, { count: symbols.length })}</span>
                </div>
                <CardContent className="p-0">
                  <MarketOverviewTable symbols={symbols} onSelectSymbol={() => setMobileTab("chart")} />
                </CardContent>
              </Card>
            </>
          )}
        </section>

        <aside className={clsx("terminal-intel-panel", mobileTab === "intel" ? "is-mobile-active" : "")} aria-label="Market statistics and news">
          {(!isCompact || mobileTab === "intel") && <IntelligenceSidebar key={mobileTab === "intel" ? "news" : "pulse"} initialTab={mobileTab === "intel" ? "news" : "pulse"} />}
        </aside>
      </div>

      <BottomStickyTickerTape />
      <MobileNavigationBar activeTab={mobileTab} onChangeTab={setMobileTab} />
    </main>
  );
}
