"use client";

import React, { useEffect, useState } from "react";
import HeaderTicker from "@/components/HeaderTicker";
import TerminalChart from "@/components/TerminalChart";
import GorenganCalculator from "@/components/GorenganCalculator";
import MarketNewsWidget from "@/components/MarketNewsWidget";
import ReportPriceModal from "@/components/ReportPriceModal";
import MacroIndicators from "@/components/MacroIndicators";
import ProvincialTable from "@/components/ProvincialTable";
import BtcParityWidget from "@/components/BtcParityWidget";
import FearGreedWidget from "@/components/FearGreedWidget";
import OrderBookWidget from "@/components/OrderBookWidget";
import TopMoversWidget from "@/components/TopMoversWidget";
import FuturesYieldWidget from "@/components/FuturesYieldWidget";
import SystemTime from "@/components/SystemTime";
import { useDashboardData } from "@/hooks/useDashboardData";

export default function Home() {
  const { data, loading, timeOffset } = useDashboardData();

  if (loading || !data) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-black text-green-500 font-mono text-xl">
        INITIALIZING NATIONAL GORENGAN TERMINAL...
      </div>
    );
  }

  // Use DKI Jakarta as the primary benchmark index for the chart
  const benchmarkData =
    data.regions.find((r) => r.region === "DKI Jakarta") || data.regions[0];
  const benchmarkPrice = benchmarkData.bakwanPrice;
  const benchmarkSentiment = benchmarkData.sentiment;

  return (
    <div className="flex flex-col min-h-screen bg-zinc-950 font-sans text-zinc-300 selection:bg-yellow-400 selection:text-black">
      <main className="flex-1 w-full flex flex-col items-center">
        <HeaderTicker />

        <div className="w-full max-w-7xl px-4 py-6 flex flex-col gap-8">
          {/* Header Section */}
          <header className="flex flex-col md:flex-row justify-between items-start md:items-end border-b border-zinc-800 pb-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tighter text-white mb-1">
                THE GORENGAN INDEX{" "}
                <span className="text-sm font-mono text-yellow-400 bg-yellow-400/10 px-2 py-1 rounded">
                  NATIONAL
                </span>
              </h1>
              <p className="text-zinc-500 font-mono text-sm">
                INDONESIA PURCHASING POWER TERMINAL // SIG-26
              </p>
            </div>
            <div className="mt-4 md:mt-0 flex flex-col items-end gap-2 font-mono text-sm">
              <ReportPriceModal regionNames={data.regions.map(r => r.region)} />
              <div className="text-right flex items-center gap-4 border border-zinc-800 p-2 rounded bg-black">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                  <span className="text-zinc-500">MKT: OPEN</span>
                </div>
                <div className="text-zinc-500">|</div>
                <div className="text-zinc-500">SYS_TIME:</div>
                <SystemTime timeOffset={timeOffset} />
              </div>
            </div>
          </header>

          {/* Macro Indicators */}
          <MacroIndicators macro={data.macro} />

          {/* Main Dashboard Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 flex flex-col gap-8">
              <TerminalChart
                livePrice={benchmarkPrice}
                sentiment={benchmarkSentiment}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <FearGreedWidget sentiment={benchmarkSentiment} volatility={data.volatilityIndex} />
                <TopMoversWidget regions={data.regions} />
              </div>

              <ProvincialTable regions={data.regions} />
              
              <FuturesYieldWidget currentPrice={benchmarkPrice} />
            </div>

            <div className="lg:col-span-1 flex flex-col gap-6">
              <OrderBookWidget currentPrice={benchmarkPrice} />
              <MarketNewsWidget headlines={data.newsHeadlines} />

              <div className="grid grid-cols-2 lg:grid-cols-1 gap-6">
                <BtcParityWidget 
                  btcIdrPrice={data.macro.btcIdrPrice} 
                  benchmarkPrice={benchmarkPrice} 
                />
                <GorenganCalculator regions={data.regions} />
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
