"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { signIn, useSession } from "next-auth/react";
import { DEFAULT_SYMBOLS } from "@gorengan/shared";
import { ArrowRight, ArrowUpRight, BarChart3 } from "lucide-react";
import { clsx } from "clsx";

import { useMarketsQuery, useSymbolsQuery, MarketOverviewTable, MarketStats } from "@/features/markets";
import { ChartHeader, TradingViewChart } from "@/features/chart";
import { Card } from "@/components/ui/card";
import RetroTerminalScene from "@/components/hero/RetroTerminalScene";
import { useTerminalWebSocket } from "@/hooks/useTerminalWebSocket";
import { useMarketStore } from "@/stores/marketStore";

export default function LandingPage() {
  const { status } = useSession();
  const isAuthenticated = status === "authenticated";
  const { data: symbolsData } = useSymbolsQuery();
  useMarketsQuery();
  const symbols = symbolsData?.symbols || DEFAULT_SYMBOLS;
  const symbolIds = useMemo(() => symbols.map((symbol) => symbol.id), [symbols]);
  useTerminalWebSocket(symbolIds, { isThrottled: !isAuthenticated, throttleMs: 5000 });

  const selectedSymbol = useMarketStore((state) => state.selectedSymbol);
  const tickers = useMarketStore((state) => state.tickers);
  const [activeTab, setActiveTab] = useState<"chart" | "markets">("chart");

  return (
    <main className="site-home min-h-screen">
      <header className="site-header">
        <div className="site-container flex min-h-16 items-center justify-between gap-4">
          <Link href="/" className="brand-link" aria-label="Gorengan Index home">
            <span className="brand-mark" aria-hidden="true">G<span>.</span></span>
            <span>Gorengan <strong>Index</strong></span>
          </Link>
          <nav aria-label="Main navigation" className="hidden sm:flex items-center gap-6 text-sm">
            <a href="#market" className="hover:text-white">Market view</a>
            <a href="#about" className="hover:text-white">About</a>
          </nav>
          <Link href="/terminal" className="site-header-action">
            Terminal <ArrowUpRight className="size-4" aria-hidden="true" />
          </Link>
        </div>
      </header>

      <div className="site-container">
        <section className="home-hero" aria-labelledby="home-title">
          <div className="home-hero-copy">
            <p className="eyebrow"><span className="eyebrow-line" /> GOR / INDEX  •  MARKET BOARD</p>
            <h1 id="home-title">Check the<br /><em>board.</em></h1>
            <p className="home-intro">Crypto, forex, and stock prices in one place. Open the board to see charts and market news.</p>
            <div className="home-actions">
              <a href="#market" className="primary-action">Open board <ArrowRight className="size-4" aria-hidden="true" /></a>
              <Link href="/terminal" className="secondary-action">Open terminal <ArrowUpRight className="size-4" aria-hidden="true" /></Link>
            </div>
            {!isAuthenticated && <p className="home-note">Public view · prices sampled every 5 seconds.</p>}
          </div>
          <div className="hero-model-wrap">
            <RetroTerminalScene />
            <div className="hero-model-caption"><span>01 / PIXEL FORMS</span><span>ILLUSTRATION / NOT MARKET DATA</span></div>
          </div>
        </section>


        <div className="tape-label"><span>THE BOARD</span><span>01 — 04 / {symbols.length.toString().padStart(2, "0")}</span></div>
          <div className="home-market-tape" aria-label="Market snapshot">
            <div className="snapshot-head"><span>From the board</span><span>{symbols.length} markets</span></div>
            {symbols.slice(0, 4).map((symbol) => {
              const ticker = tickers[symbol.id];
              const change = ticker?.changePercent24h;
              return (
                <div key={symbol.id} className="snapshot-row">
                  <div><strong>{symbol.id}</strong><span>{symbol.name}</span></div>
                  <div className="snapshot-value">
                    <strong>{ticker?.price ? ticker.price.toLocaleString("en-US", { maximumFractionDigits: 2 }) : "—"}</strong>
                    <span className={change == null ? "" : change >= 0 ? "price-up" : "price-down"}>
                      {change == null ? "Waiting for price" : `${change >= 0 ? "+" : ""}${change.toFixed(2)}%`}
                    </span>
                  </div>
                </div>
              );
            })}

          </div>
        <section id="market" className="market-section" aria-labelledby="market-title">
          <div className="section-heading">
            <div><p className="eyebrow">Market view</p><h2 id="market-title">On the board</h2></div>
            <p>{isAuthenticated ? "Your market workspace is ready." : "Public quotes sampled every 5 seconds."}</p>
          </div>
          <div className="preview-shell">
            <div className="preview-toolbar">
              <div role="tablist" aria-label="Market view" className="preview-tabs">
                <button type="button" role="tab" aria-selected={activeTab === "chart"} onClick={() => setActiveTab("chart")} className={clsx(activeTab === "chart" && "is-active")}>Chart</button>
                <button type="button" role="tab" aria-selected={activeTab === "markets"} onClick={() => setActiveTab("markets")} className={clsx(activeTab === "markets" && "is-active")}>Markets</button>
              </div>
              <span className="preview-status"><span className="status-dot" /> {isAuthenticated ? "Live stream" : "5s updates"}</span>
            </div>
            <div className="preview-content">
              {activeTab === "chart" ? (
                <div className="preview-grid">
                  <Card className="preview-chart"><ChartHeader /><div className="h-[350px] sm:h-[450px]"><TradingViewChart key={selectedSymbol} symbol={selectedSymbol} className="h-full w-full" /></div></Card>
                  <aside className="preview-aside" aria-label="Market statistics"><div className="preview-aside-title"><BarChart3 className="size-4" /> Market snapshot</div><MarketStats /></aside>
                </div>
              ) : <Card className="preview-table"><MarketOverviewTable symbols={symbols} /></Card>}
            </div>
          </div>
        </section>

        <section id="about" className="about-section" aria-labelledby="about-title">
          <div><p className="eyebrow">The workspace</p><h2 id="about-title">Keep your eye on the board.</h2></div>
          <div className="about-copy"><p>Pin the symbols you follow. Check the chart. Read the news. Then get back to your day.</p><p>The board is open to everyone. Sign in to keep a watchlist and open the full terminal.</p>{isAuthenticated ? <Link href="/terminal" className="text-action">Open your terminal <ArrowRight className="size-4" /></Link> : <button type="button" onClick={() => signIn("google", { callbackUrl: "/terminal" })} className="text-action">Continue with Google <ArrowRight className="size-4" /></button>}</div>
        </section>
      </div>
      <footer className="site-footer"><div className="site-container"><span>Gorengan Index</span><span>Market data for personal research</span></div></footer>
    </main>
  );
}
