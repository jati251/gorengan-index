"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useSession, signIn } from "next-auth/react";
import { DEFAULT_SYMBOLS } from "@gorengan/shared";
import {
  Activity,
  Zap,
  ArrowRight,
  BarChart3,
  TrendingUp,
  Cpu,
  Radio,
  Lock,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import { clsx } from "clsx";

import { useSymbolsQuery, useMarketsQuery } from "@/features/markets";
import { MarketOverviewTable, MarketStats } from "@/features/markets";
import { TradingViewChart, ChartHeader } from "@/features/chart";
import { UserNav } from "@/features/auth";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { useTerminalWebSocket } from "@/hooks/useTerminalWebSocket";
import { useMarketStore } from "@/stores/marketStore";

export default function LandingPage() {
  const { data: session, status } = useSession();
  const isAuthenticated = status === "authenticated";

  const { data: symbolsData } = useSymbolsQuery();
  useMarketsQuery();

  const symbols = symbolsData?.symbols || DEFAULT_SYMBOLS;
  const symbolIds = React.useMemo(() => symbols.map((s) => s.id), [symbols]);

  // Connect throttled WebSocket for unauthenticated visitors (5s sample interval)
  // If already authenticated, use unthrottled real-time stream
  useTerminalWebSocket(symbolIds, {
    isThrottled: !isAuthenticated,
    throttleMs: 5000,
  });

  const selectedSymbol = useMarketStore((s) => s.selectedSymbol);
  const tickers = useMarketStore((s) => s.tickers);
  const priceDirections = useMarketStore((s) => s.priceDirections);

  const [activePreviewTab, setActivePreviewTab] = useState<"chart" | "table">("chart");

  return (
    <div className="min-h-screen flex flex-col bg-[#030611] text-slate-100 font-sans selection:bg-emerald-500/30 overflow-x-hidden">
      {/* ─── Top Global Navbar ────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-white/[0.08] bg-[#050916]/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2.5 group">
              <div className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 shadow-[0_0_12px_rgba(16,185,129,0.25)] group-hover:bg-emerald-500/20 transition-all">
                <Activity className="w-4 h-4 text-emerald-400 animate-pulse" />
              </div>
              <span className="font-mono text-base font-bold text-white tracking-tight">
                Gorengan
                <span className="text-emerald-400 text-xs ml-1 px-1.5 py-0.5 rounded bg-emerald-950/70 border border-emerald-500/40">
                  INDEX
                </span>
              </span>
            </Link>

            <nav className="hidden md:flex items-center gap-6 text-xs font-mono text-slate-300">
              <a href="#features" className="hover:text-emerald-400 transition-colors">
                Features
              </a>
              <a href="#preview" className="hover:text-emerald-400 transition-colors">
                Live Preview
              </a>
              <a href="#architecture" className="hover:text-emerald-400 transition-colors">
                Technology
              </a>
            </nav>
          </div>

          <div className="flex items-center gap-3">
            {isAuthenticated ? (
              <>
                <Link
                  href="/terminal"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold text-black bg-emerald-400 hover:bg-emerald-300 transition-all shadow-[0_0_16px_rgba(16,185,129,0.4)]"
                >
                  <span>Open Terminal</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
                <UserNav />
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => signIn("google", { callbackUrl: "/terminal" })}
                  className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-mono text-slate-300 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.1] transition-all cursor-pointer"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  <span>Sign In</span>
                </button>

                <Link
                  href="/terminal"
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-mono font-semibold text-black bg-emerald-400 hover:bg-emerald-300 transition-all shadow-[0_0_18px_rgba(16,185,129,0.35)]"
                >
                  <span>Launch Terminal</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ─── Hero Section ────────────────────────────────────────────── */}
      <section className="relative pt-16 pb-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto flex flex-col items-center text-center">
        {/* Glow ambient background effects */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-gradient-to-tr from-emerald-500/15 via-teal-500/10 to-transparent blur-[120px] pointer-events-none rounded-full" />
        <div className="absolute top-1/3 right-10 w-[300px] h-[300px] bg-cyan-500/10 blur-[100px] pointer-events-none rounded-full" />

        {/* Top category pill */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.08] text-xs font-mono text-emerald-400 mb-6 shadow-[0_0_20px_rgba(16,185,129,0.1)]">
          <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
          <span>Indonesian Stock & Global Synthetic Volatility Terminal</span>
        </div>

        {/* Main Title */}
        <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white max-w-4xl leading-[1.15]">
          Institutional Precision for{" "}
          <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">
            Indonesian Gorengan
          </span>{" "}
          & Global Markets
        </h1>

        <p className="mt-5 text-sm sm:text-base lg:text-lg text-slate-300 max-w-2xl leading-relaxed">
          Sub-millisecond Rust distribution engine, live IDX order flow, anomaly detection,
          and TradingView candlestick intelligence built for modern traders.
        </p>

        {/* Hero CTA buttons */}
        <div className="mt-8 flex flex-col sm:flex-row items-center gap-3.5 w-full sm:w-auto">
          {isAuthenticated ? (
            <Link
              href="/terminal"
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-mono text-sm font-bold text-black bg-emerald-400 hover:bg-emerald-300 transition-all shadow-[0_0_25px_rgba(16,185,129,0.4)] cursor-pointer"
            >
              <span>Enter Full Pro Terminal</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => signIn("google", { callbackUrl: "/terminal" })}
              className="w-full sm:w-auto flex items-center justify-center gap-3 px-6 py-3 rounded-xl font-mono text-sm font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 border border-emerald-400/30 transition-all shadow-[0_0_25px_rgba(16,185,129,0.35)] cursor-pointer"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>Sign In with Google to Unlock Full Stream</span>
            </button>
          )}

          <a
            href="#preview"
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-mono text-xs text-slate-300 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.1] transition-all"
          >
            <span>Explore Live Preview (Delayed)</span>
            <span className="text-amber-400 font-bold">5s</span>
          </a>
        </div>

        {/* Live Market Mini Strip */}
        <div className="mt-12 w-full max-w-4xl grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 font-mono text-left">
          {symbols.slice(0, 6).map((sym) => {
            const ticker = tickers[sym.id];
            const price = ticker?.price ?? 0;
            const change = ticker?.changePercent24h ?? 0;
            const isPos = change >= 0;
            const dir = priceDirections[sym.id];

            return (
              <div
                key={sym.id}
                className={clsx(
                  "p-2.5 rounded-lg border bg-white/[0.02] transition-colors relative overflow-hidden",
                  dir === "up"
                    ? "border-emerald-500/50 bg-emerald-500/10"
                    : dir === "down"
                      ? "border-rose-500/50 bg-rose-500/10"
                      : "border-white/[0.07]"
                )}
              >
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-bold text-white">{sym.name}</span>
                  <span
                    className={clsx(
                      "text-[10px] font-semibold",
                      isPos ? "text-emerald-400" : "text-rose-400"
                    )}
                  >
                    {isPos ? "+" : ""}
                    {change.toFixed(1)}%
                  </span>
                </div>
                <div className="mt-1 text-xs font-bold text-slate-200">
                  {price > 0
                    ? price.toLocaleString("id-ID", {
                        maximumFractionDigits: sym.assetClass === "crypto" ? 2 : 0,
                      })
                    : "—"}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ─── Live Preview Section ────────────────────────────────────── */}
      <section id="preview" className="py-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
        {/* Banner highlighting Preview Mode vs Full Pro */}
        <div className="mb-6 p-3.5 sm:p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-mono">
          <div className="flex items-center gap-2.5 text-amber-300">
            <Radio className="w-4 h-4 text-amber-400 animate-pulse shrink-0" />
            <div>
              <span className="font-bold text-amber-400 uppercase tracking-wide">
                Preview Mode (5s Sampled Data):
              </span>{" "}
              <span className="text-slate-300">
                You are viewing a delayed stream. Sign in to unlock sub-second ultra low latency,
                1s candles, and full orderflow intelligence.
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => signIn("google", { callbackUrl: "/terminal" })}
            className="shrink-0 px-3.5 py-1.5 rounded-lg font-bold text-black bg-amber-400 hover:bg-amber-300 transition-colors shadow-[0_0_12px_rgba(245,158,11,0.3)] cursor-pointer"
          >
            Unlock Pro Terminal →
          </button>
        </div>

        {/* Interactive Preview Container */}
        <div className="rounded-2xl border border-white/[0.1] bg-[#070b18]/90 shadow-[0_16px_48px_rgba(0,0,0,0.5)] overflow-hidden">
          {/* Preview Navigation Bar */}
          <div className="px-4 py-3 border-b border-white/[0.08] bg-white/[0.02] flex items-center justify-between">
            <div className="flex items-center gap-2 font-mono text-xs">
              <button
                type="button"
                onClick={() => setActivePreviewTab("chart")}
                className={clsx(
                  "px-3 py-1.5 rounded-md font-semibold transition-all cursor-pointer",
                  activePreviewTab === "chart"
                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                    : "text-slate-400 hover:text-white"
                )}
              >
                Candlestick Chart
              </button>
              <button
                type="button"
                onClick={() => setActivePreviewTab("table")}
                className={clsx(
                  "px-3 py-1.5 rounded-md font-semibold transition-all cursor-pointer",
                  activePreviewTab === "table"
                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                    : "text-slate-400 hover:text-white"
                )}
              >
                Market Overview Table
              </button>
            </div>

            <div className="hidden sm:flex items-center gap-2 text-[11px] font-mono text-slate-400">
              <span className="inline-block w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              <span>Throttled Stream (5000ms)</span>
            </div>
          </div>

          {/* Preview Content */}
          <div className="p-3 sm:p-4">
            {activePreviewTab === "chart" ? (
              <div className="flex flex-col gap-3">
                <Card className="flex flex-col shadow-none border-white/[0.07]">
                  <ChartHeader />
                  <div className="w-full h-[380px] sm:h-[450px] bg-[#080d1a]/80">
                    <TradingViewChart
                      key={selectedSymbol}
                      symbol={selectedSymbol}
                      className="w-full h-full"
                    />
                  </div>
                </Card>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Card className="p-3 border-white/[0.07]">
                    <div className="flex items-center gap-2 mb-2 font-mono text-xs font-bold text-slate-300">
                      <BarChart3 className="w-3.5 h-3.5 text-amber-400" />
                      <span>Market Stats Snapshot</span>
                    </div>
                    <MarketStats />
                  </Card>

                  <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-950/40 to-teal-950/20 border border-emerald-500/20 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-2 text-xs font-mono font-bold text-emerald-400 mb-1">
                        <Zap className="w-4 h-4 text-emerald-400" />
                        <span>Ready for Zero-Lag Trading?</span>
                      </div>
                      <p className="text-xs text-slate-300 leading-relaxed">
                        Upgrade to authenticated Pro mode for tick-by-tick real-time execution,
                        institutional depth, customizable watchlists, and macro news feeds.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => signIn("google", { callbackUrl: "/terminal" })}
                      className="mt-3 w-full py-2 rounded-lg font-mono text-xs font-bold text-black bg-emerald-400 hover:bg-emerald-300 transition-colors shadow-[0_0_12px_rgba(16,185,129,0.3)] cursor-pointer"
                    >
                      Sign In with Google to Unlock →
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <Card className="shadow-none border-white/[0.07]">
                <CardHeader className="py-2.5 border-b border-white/[0.07]">
                  <CardTitle className="text-xs sm:text-sm font-mono flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5 text-emerald-400" />
                      Live Market Tickers
                    </span>
                    <span className="text-[10px] text-amber-400 px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20">
                      Sampled Preview
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <MarketOverviewTable symbols={symbols} />
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </section>

      {/* ─── Features Grid ───────────────────────────────────────────── */}
      <section id="features" className="py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
        <div className="text-center mb-12">
          <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
            Engineered for Extreme Financial Volatility
          </h2>
          <p className="mt-3 text-sm sm:text-base text-slate-400 max-w-2xl mx-auto">
            Traditional broker feeds are sluggish. Gorengan Index gives you microsecond-level
            intelligence built with modern systems programming.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/[0.08] hover:border-emerald-500/30 transition-all flex flex-col justify-between">
            <div>
              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-3.5">
                <Cpu className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-white font-mono">Microsecond Rust Engine</h3>
              <p className="mt-2 text-xs text-slate-400 leading-relaxed">
                Asynchronous event processing using Tokio, Axum, and high-performance NATS streaming
                with minimal CPU overhead.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-white/[0.06] text-[10px] font-mono text-emerald-400">
              Zero Garbage Collection
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/[0.08] hover:border-emerald-500/30 transition-all flex flex-col justify-between">
            <div>
              <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 mb-3.5">
                <TrendingUp className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-white font-mono">Gorengan Volatility Radar</h3>
              <p className="mt-2 text-xs text-slate-400 leading-relaxed">
                Algorithmic detection of unusual volume spikes, momentum shifts, and sudden price
                expansions across IDX tickers.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-white/[0.06] text-[10px] font-mono text-cyan-400">
              Live Anomaly Scoring
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/[0.08] hover:border-emerald-500/30 transition-all flex flex-col justify-between">
            <div>
              <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-3.5">
                <BarChart3 className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-white font-mono">Institutional Depth</h3>
              <p className="mt-2 text-xs text-slate-400 leading-relaxed">
                Order flow reconstruction and volume profile mapping to track institutional
                liquidity absorption and support levels.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-white/[0.06] text-[10px] font-mono text-amber-400">
              Order Flow Reconstruction
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/[0.08] hover:border-emerald-500/30 transition-all flex flex-col justify-between">
            <div>
              <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 mb-3.5">
                <Zap className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-white font-mono">AI News & Macro Pulse</h3>
              <p className="mt-2 text-xs text-slate-400 leading-relaxed">
                Automated Indonesian financial news clustering with real-time sentiment scoring and
                macro impact prediction.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-white/[0.06] text-[10px] font-mono text-purple-400">
              Real-Time Sentiment Analysis
            </div>
          </div>
        </div>
      </section>

      {/* ─── Plan / Access Matrix ────────────────────────────────────── */}
      <section className="py-12 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto w-full">
        <div className="rounded-2xl border border-white/[0.1] bg-[#050814]/90 p-6 sm:p-8">
          <div className="text-center mb-8">
            <h3 className="text-xl sm:text-2xl font-bold text-white font-mono">
              Compare Access Levels
            </h3>
            <p className="text-xs sm:text-sm text-slate-400 mt-1 font-mono">
              Unlock the full terminal instantly with your Google account
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Free / Guest */}
            <div className="p-5 rounded-xl bg-white/[0.02] border border-white/[0.07] flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="font-mono text-xs font-bold text-slate-300">GUEST PREVIEW</span>
                  <span className="text-[10px] font-mono text-amber-400 px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/30">
                    Active on Landing
                  </span>
                </div>
                <ul className="space-y-2.5 text-xs text-slate-300 font-mono">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-slate-400" />
                    <span>5-Second throttled ticker updates</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-slate-400" />
                    <span>Basic candlestick charts (1m base)</span>
                  </li>
                  <li className="flex items-center gap-2 text-slate-500">
                    <Lock className="w-3.5 h-3.5" />
                    <span>No 1-second high-frequency crypto stream</span>
                  </li>
                  <li className="flex items-center gap-2 text-slate-500">
                    <Lock className="w-3.5 h-3.5" />
                    <span>No full intelligence news & orderflow sidebar</span>
                  </li>
                </ul>
              </div>
            </div>

            {/* Authenticated PRO */}
            <div className="p-5 rounded-xl bg-gradient-to-b from-emerald-950/40 to-teal-950/20 border border-emerald-500/30 shadow-[0_0_24px_rgba(16,185,129,0.15)] flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="font-mono text-xs font-bold text-emerald-400">
                    AUTHENTICATED PRO
                  </span>
                  <span className="text-[10px] font-mono text-emerald-400 px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 font-bold">
                    FULL ACCESS
                  </span>
                </div>
                <ul className="space-y-2.5 text-xs text-slate-200 font-mono">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Sub-second ultra-low latency WebSocket</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>1-second high-frequency crypto candles</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Full intelligence news sentiment & depth stream</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Dedicated full terminal workspace (`/terminal`)</span>
                  </li>
                </ul>
              </div>

              <button
                type="button"
                onClick={() => signIn("google", { callbackUrl: "/terminal" })}
                className="mt-5 w-full py-2.5 rounded-lg font-mono text-xs font-bold text-black bg-emerald-400 hover:bg-emerald-300 transition-colors shadow-[0_0_16px_rgba(16,185,129,0.35)] cursor-pointer"
              >
                Sign In with Google to Unlock Full Access →
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Footer ─────────────────────────────────────────────────── */}
      <footer className="mt-auto border-t border-white/[0.08] bg-[#02050e] py-8 text-center text-xs font-mono text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-white font-bold">Gorengan Index</span>
            <span>· Built with Rust & Next.js</span>
          </div>
          <div className="flex items-center gap-4 text-[11px]">
            <span>v1.4.0-pro</span>
            <span className="inline-flex items-center gap-1.5 text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              Gateway Healthy
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
