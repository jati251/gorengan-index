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
import { useTranslation, LanguageSwitcher } from "@/features/i18n";

function getChangeClass(change: number | null | undefined): string {
  if (change == null) return "";
  return change >= 0 ? "price-up" : "price-down";
}

function formatChangeText(change: number | null | undefined, waitingText: string): string {
  if (change == null) return waitingText;
  const sign = change >= 0 ? "+" : "";
  return `${sign}${change.toFixed(2)}%`;
}

export default function LandingPage() {
  const { status } = useSession();
  const isAuthenticated = status === "authenticated";
  const { dict, interpolate, locale } = useTranslation();
  const { data: symbolsData } = useSymbolsQuery();
  useMarketsQuery();
  const serverSymbols = symbolsData?.symbols;
  const symbols = useMemo(() => {
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

  // Curate 2 representative items per asset class category for landing page
  const landingSymbols = useMemo(() => {
    const counts: Record<string, number> = {
      crypto: 0,
      fx: 0,
      us_stocks: 0,
      idx_stocks: 0,
    };
    const result: typeof symbols = [];

    for (const sym of symbols) {
      let cat = sym.assetClass as string;
      if (cat === "stocks" || cat === "equity") {
        cat = sym.id.startsWith("ID:") ? "idx_stocks" : "us_stocks";
      }
      if (counts[cat] !== undefined && counts[cat] < 2) {
        result.push(sym);
        counts[cat]++;
      }
    }
    return result.length > 0 ? result : symbols.slice(0, 8);
  }, [symbols]);

  const symbolIds = useMemo(() => landingSymbols.map((symbol) => symbol.id), [landingSymbols]);
  useTerminalWebSocket(symbolIds, { isThrottled: !isAuthenticated, throttleMs: 5000 });

  const selectedSymbol = useMarketStore((state) => state.selectedSymbol);
  const tickers = useMarketStore((state) => state.tickers);
  const [activeTab, setActiveTab] = useState<"chart" | "markets">("chart");

  return (
    <main className="site-home min-h-screen">
      <header className="site-header">
        <div className="site-container flex min-h-14 sm:min-h-16 items-center justify-between gap-2 sm:gap-4">
          <Link href="/" className="brand-link" aria-label="Gorengan Index home">
            <span className="brand-mark" aria-hidden="true">G<span>.</span></span>
            <span>Gorengan <strong className="hidden sm:inline">Index</strong></span>
          </Link>
          <nav aria-label="Main navigation" className="hidden sm:flex items-center gap-6 text-sm">
            <a href="#market" className="hover:text-white">{dict.landing.nav.marketView}</a>
            <a href="#about" className="hover:text-white">{dict.landing.nav.about}</a>
            <a href="#faq" className="hover:text-white">{dict.landing.nav.faq}</a>
          </nav>
          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            <LanguageSwitcher />
            <Link href="/terminal" className="site-header-action">
              <span>{dict.landing.nav.terminal}</span> <ArrowUpRight className="size-3.5 sm:size-4 shrink-0" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </header>

      <div className="site-container">
        <section className="home-hero" aria-labelledby="home-title">
          <div className="home-hero-copy">
            <p className="eyebrow"><span className="eyebrow-line" /> {dict.landing.hero.eyebrow}</p>
            <h1 id="home-title">{dict.landing.hero.titleMain}<br /><em>{dict.landing.hero.titleAccent}</em></h1>
            <p className="home-intro">{dict.landing.hero.intro}</p>
            <div className="home-actions">
              <a href="#market" className="primary-action">{dict.landing.hero.openBoard} <ArrowRight className="size-4" aria-hidden="true" /></a>
              <Link href="/terminal" className="secondary-action">{dict.landing.hero.openTerminal} <ArrowUpRight className="size-4" aria-hidden="true" /></Link>
            </div>
            {!isAuthenticated && <p className="home-note">{dict.landing.hero.publicNotice}</p>}
          </div>
          <div className="hero-model-wrap">
            <RetroTerminalScene />
          </div>
        </section>

        <div className="tape-label">
          <span>{dict.landing.tape.boardLabel}</span>
          <span>01 — {landingSymbols.length.toString().padStart(2, "0")} / {landingSymbols.length.toString().padStart(2, "0")}</span>
        </div>
        <div className="home-market-tape" aria-label="Market snapshot">
          <div className="snapshot-head">
            <span>{dict.landing.tape.featuredTitle}</span>
            <span>{interpolate(dict.landing.tape.assetsCount, { count: landingSymbols.length })}</span>
          </div>
          {landingSymbols.map((symbol) => {
            const ticker = tickers[symbol.id];
            const change = ticker?.changePercent24h;
            return (
              <div key={symbol.id} className="snapshot-row">
                <div><strong>{symbol.id}</strong><span>{symbol.name}</span></div>
                <div className="snapshot-value">
                  <strong>
                    {ticker?.price
                      ? ticker.price.toLocaleString(locale === "id" ? "id-ID" : "en-US", { maximumFractionDigits: 2 })
                      : "—"}
                  </strong>
                  <span className={getChangeClass(change)}>
                    {formatChangeText(change, dict.landing.tape.waitingForPrice)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        <section id="market" className="market-section" aria-labelledby="market-title">
          <div className="section-heading">
            <div>
              <p className="eyebrow">{dict.landing.market.eyebrow}</p>
              <h2 id="market-title">{dict.landing.market.title}</h2>
            </div>
            <p>{isAuthenticated ? dict.landing.market.authSubtitle : dict.landing.market.publicSubtitle}</p>
          </div>
          <div className="preview-shell">
            <div className="preview-toolbar">
              <div role="tablist" aria-label="Market view" className="preview-tabs">
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === "chart"}
                  onClick={() => setActiveTab("chart")}
                  className={clsx(activeTab === "chart" && "is-active")}
                >
                  {dict.landing.market.tabChart}
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === "markets"}
                  onClick={() => setActiveTab("markets")}
                  className={clsx(activeTab === "markets" && "is-active")}
                >
                  {dict.landing.market.tabMarkets}
                </button>
              </div>
              <span className="preview-status">
                <span className="status-dot" />{" "}
                {isAuthenticated ? dict.landing.market.liveStream : dict.landing.market.sampleUpdates}
              </span>
            </div>
            <div className="preview-content">
              {activeTab === "chart" ? (
                <div className="preview-grid">
                  <Card className="preview-chart">
                    <ChartHeader />
                    <div className="h-[350px] sm:h-[450px]">
                      <TradingViewChart key={selectedSymbol} symbol={selectedSymbol} className="h-full w-full" />
                    </div>
                  </Card>
                  <aside className="preview-aside" aria-label="Market statistics">
                    <div className="preview-aside-title">
                      <BarChart3 className="size-4" /> {dict.landing.market.marketSnapshot}
                    </div>
                    <MarketStats />
                  </aside>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  <Card className="preview-table">
                    <MarketOverviewTable symbols={landingSymbols} />
                  </Card>
                  <div className="flex items-center justify-between px-2 py-1 text-xs font-mono text-slate-400">
                    <span>{interpolate(dict.landing.market.showingFeatured, { count: landingSymbols.length })}</span>
                    <Link
                      href="/terminal"
                      className="text-emerald-400 hover:text-emerald-300 inline-flex items-center gap-1 font-semibold transition-colors cursor-pointer"
                    >
                      {interpolate(dict.landing.market.openTerminalAll, { count: symbols.length })} <ArrowRight className="size-3.5" />
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        <section id="about" className="about-section" aria-labelledby="about-title">
          <div>
            <p className="eyebrow">{dict.landing.about.eyebrow}</p>
            <h2 id="about-title">{dict.landing.about.title}</h2>
          </div>
          <div className="about-copy">
            <p>{dict.landing.about.desc1}</p>
            <p>{dict.landing.about.desc2}</p>
            {isAuthenticated ? (
              <Link href="/terminal" className="text-action">
                {dict.landing.about.openTerminal} <ArrowRight className="size-4" />
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => signIn("google", { callbackUrl: "/terminal" })}
                className="text-action"
              >
                {dict.landing.about.continueWithGoogle} <ArrowRight className="size-4" />
              </button>
            )}
          </div>
        </section>

        <section id="faq" className="faq-section" aria-labelledby="faq-title">
          <div>
            <p className="eyebrow">{dict.landing.faq.eyebrow}</p>
            <h2 id="faq-title">{dict.landing.faq.title}</h2>
          </div>
          <div className="faq-grid">
            {dict.landing.faq.items.map((item, idx) => (
              <details key={idx} className="faq-item" open={idx === 0}>
                <summary className="faq-summary">{item.question}</summary>
                <div className="faq-answer">{item.answer}</div>
              </details>
            ))}
          </div>
        </section>
      </div>

      <footer className="site-footer">
        <div className="site-container">
          <span>{dict.landing.footer.brandTagline}</span>
          <span>{dict.landing.footer.disclaimer}</span>
        </div>
      </footer>
    </main>
  );
}
