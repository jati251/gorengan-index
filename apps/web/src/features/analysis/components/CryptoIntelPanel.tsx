"use client";

import { useState } from "react";
import {
  Activity,
  Flame,
  Landmark,
  Zap,
  TrendingUp,
  TrendingDown,
  Layers,
  RefreshCw,
  Eye,
} from "lucide-react";
import { useNow } from "@/hooks/useNow";
import { freshCryptoFlow } from "../utils/cryptoFlow";
import { TIMEFRAME_MS } from "@gorengan/shared";
import { useAnalysis } from "../hooks/useAnalysis";
import { useCryptoIntelQuery } from "../api/useCryptoIntelQuery";
import { marketSignals, positionPlan, computeCryptoIntelComposite, type RiskInput } from "../utils/cryptoSignals";
import { useWhaleRadarQuery } from "@/features/whale/api/useWhaleRadarQuery";
import { TimeframeSelector } from "@/features/chart/components/TimeframeSelector";
import { useTranslation } from "@/features/i18n";
import { useMarketStore } from "@/stores/marketStore";

const number = (n: number | null | undefined, digits = 2) =>
  n == null || !Number.isFinite(n) ? "—" : n.toLocaleString("en-US", { maximumFractionDigits: digits });

export function CryptoIntelPanel() {
  const symbol = useMarketStore((s) => s.selectedSymbol);
  return <CryptoIntelWorkspace key={symbol} />;
}

function CryptoIntelWorkspace() {
  const { locale } = useTranslation();
  const id = locale === "id";
  const t = (a: string, b: string) => (id ? a : b);

  const history = useAnalysis();
  const { symbol, timeframe, candles } = history;
  const supported = /^[A-Z0-9]{2,15}-USDT$/.test(symbol);
  const isBtc = symbol.startsWith("BTC");

  const [threshold, setThreshold] = useState(50000);
  const now = useNow();
  const [input, setInput] = useState<RiskInput>({
    capital: 1000,
    riskPercent: 1,
    entry: 0,
    stop: 0,
    target: 0,
    feePercent: 0.1,
    slippagePercent: 0.1,
    lotSize: 0.000001,
  });

  // TanStack Query via Feature API Layer
  const flow = useCryptoIntelQuery(symbol, supported);
  const whaleRadar = useWhaleRadarQuery(isBtc && supported);

  const signals = marketSignals(candles, symbol, timeframe, now);
  const staleCandles = !signals || history.isError || now - signals.last.closeTime > TIMEFRAME_MS[timeframe] * 2;
  const data = flow.isError ? null : freshCryptoFlow(flow.data, now, symbol);
  const staleFlow = !data;
  const trades = data?.trades ?? null;
  const funding = data?.derivatives ?? null;
  const interest = data?.openInterest ?? null;
  const depth = data?.depth;
  const composite = computeCryptoIntelComposite(staleCandles ? null : signals, data, null, id);

  const largeTrades = trades?.largest.filter((row) => row.value >= threshold) ?? [];
  const plan = positionPlan(input);

  if (!supported) {
    return (
      <section className="desk-panel desk-empty">
        <h2>Crypto Intel & Order Flow Desk</h2>
        <p>
          {t(
            "Pilih pasangan crypto USDT (misalnya BTC-USDT). Panel ini menganalisis buku order Binance spot, tape transaksi, serta derivatif USDT perpetual.",
            "Choose a crypto USDT pair such as BTC-USDT. This panel covers Binance spot order book depth, aggregate trade flow, and perpetual derivatives."
          )}
        </p>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      {/* Main Intel Panel */}
      <section className="desk-panel">
        <div className="desk-panel-head flex-wrap gap-2">
          <div>
            <span className="desk-eyebrow">{symbol} · {timeframe}</span>
            <h2>{t("Intel Kuantitatif & Aliran Pasar Crypto", "Crypto Quantitative Intel & Market Flow")}</h2>
          </div>
          <button
            type="button"
            className="desk-button inline-flex items-center gap-1.5 cursor-pointer shrink-0"
            disabled={flow.isFetching || history.isFetching}
            onClick={() => {
              void flow.refetch();
              void history.refetch();
            }}
          >
            <RefreshCw size={13} className={flow.isFetching ? "desk-spin" : ""} />
            <span>{t("Perbarui data", "Refresh data")}</span>
          </button>
        </div>

        <div className="analysis-toolbar">
          <TimeframeSelector />
          <span>Binance Spot & Perps · {t("polling otomatis 20 detik", "20-second live polling")}</span>
        </div>

        <div className="intel-body">
          {!composite && <p className="text-sm text-zinc-400" role="status">{t("Skor gabungan ditahan sampai candle, transaksi, order book, dan derivatif tersedia dan masih segar.", "Composite score withheld until candles, trades, order book and derivatives are available and fresh.")}</p>}
          {/* Hero Composite Score Banner */}
          {composite && (
            <div className="p-4 md:p-5 rounded-2xl bg-gradient-to-br from-zinc-900/90 via-zinc-900/70 to-zinc-950 border border-zinc-800 shadow-lg space-y-3">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-zinc-800/80 pb-3">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 font-mono font-bold text-lg">
                    {composite.compositeScore}
                  </div>
                  <div>
                    <div className="text-[11px] font-mono uppercase tracking-wider text-zinc-400">
                      {t("Skor Konfluensi Heuristik", "Heuristic Confluence Score")}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-sm font-bold text-zinc-100 font-mono">
                        {composite.regimeLabel}
                      </span>
                      <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                        {t("Win rate belum terukur", "Win rate not measured")}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-stretch sm:self-auto justify-between sm:justify-end">
                  <span className="text-xs text-zinc-400 font-medium">
                    {t("Rekomendasi Aksi:", "Execution Stance:")}
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-zinc-800 text-zinc-200 border border-zinc-700 font-mono text-xs font-semibold">
                    {composite.executionPlan.stanceLabel}
                  </span>
                </div>
              </div>

              <p className="text-xs text-zinc-300 leading-relaxed font-sans">
                {composite.actionableThesis}
              </p>
            </div>
          )}

          {/* 4-Pillar Quantitative Factor Cards */}
          {composite && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Pillar 1: Technical & Momentum */}
              <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800/80 space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-zinc-300 inline-flex items-center gap-1.5 font-mono">
                    <Activity size={14} className="text-blue-400" />
                    <span>{t("Teknikal", "Technical")}</span>
                  </span>
                  <span className="font-mono text-xs font-bold text-blue-400">
                    {composite.factors.technicalScore}/25
                  </span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full"
                    style={{ width: `${(composite.factors.technicalScore / 25) * 100}%` }}
                  />
                </div>
                <div className="text-[11px] text-zinc-400 space-y-1 font-mono">
                  <div className="flex justify-between">
                    <span>{t("Tren", "Trend")}</span>
                    <span className="font-bold text-zinc-200 uppercase">{signals?.trend ?? "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>RVOL</span>
                    <span className="text-zinc-200">{number(signals?.relativeVolume)}×</span>
                  </div>
                  <div className="flex justify-between">
                    <span>RSI 14</span>
                    <span className="text-zinc-200">{number(signals?.rsi)}</span>
                  </div>
                </div>
              </div>

              {/* Pillar 2: Order Flow & CVD */}
              <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800/80 space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-zinc-300 inline-flex items-center gap-1.5 font-mono">
                    <Flame size={14} className="text-emerald-400" />
                    <span>Order Flow</span>
                  </span>
                  <span className="font-mono text-xs font-bold text-emerald-400">
                    {composite.factors.orderFlowScore}/25
                  </span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full"
                    style={{ width: `${(composite.factors.orderFlowScore / 25) * 100}%` }}
                  />
                </div>
                <div className="text-[11px] text-zinc-400 space-y-1 font-mono">
                  <div className="flex justify-between">
                    <span>Taker Buy</span>
                    <span className="font-bold text-emerald-400">{number(trades?.buyRatio)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>CVD Delta</span>
                    <span className={trades && trades.cvd >= 0 ? "text-emerald-400" : "text-rose-400"}>
                      {trades ? (trades.cvd >= 0 ? "+$" : "-$") + Math.abs(Math.round(trades.cvd)).toLocaleString() : "—"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Whale Net</span>
                    <span className={trades && trades.whaleNetValue >= 0 ? "text-emerald-400" : "text-rose-400"}>
                      {trades ? (trades.whaleNetValue >= 0 ? "+$" : "-$") + Math.abs(Math.round(trades.whaleNetValue)).toLocaleString() : "—"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Pillar 3: Order Book Microstructure */}
              <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800/80 space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-zinc-300 inline-flex items-center gap-1.5 font-mono">
                    <Layers size={14} className="text-purple-400" />
                    <span>{t("Buku Order", "Order Book")}</span>
                  </span>
                  <span className="font-mono text-xs font-bold text-purple-400">
                    {composite.factors.microstructureScore}/25
                  </span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                  <div
                    className="h-full bg-purple-500 rounded-full"
                    style={{ width: `${(composite.factors.microstructureScore / 25) * 100}%` }}
                  />
                </div>
                <div className="text-[11px] text-zinc-400 space-y-1 font-mono">
                  <div className="flex justify-between">
                    <span>20-L Imbalance</span>
                    <span className={depth && depth.imbalance >= 0 ? "text-emerald-400" : "text-rose-400"}>
                      {depth ? (depth.imbalance >= 0 ? "+" : "") + depth.imbalance.toFixed(1) + "%" : "—"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Top-5 Imbalance</span>
                    <span className={depth && depth.top5Imbalance >= 0 ? "text-emerald-400" : "text-rose-400"}>
                      {depth ? (depth.top5Imbalance >= 0 ? "+" : "") + depth.top5Imbalance.toFixed(1) + "%" : "—"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Spread Spot</span>
                    <span className="text-zinc-200">{number(depth?.spreadPercent, 4)}%</span>
                  </div>
                </div>
              </div>

              {/* Pillar 4: Derivatives & Squeeze Matrix */}
              <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800/80 space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-zinc-300 inline-flex items-center gap-1.5 font-mono">
                    <Zap size={14} className="text-amber-400" />
                    <span>{t("Derivatif & OI", "Derivatives & OI")}</span>
                  </span>
                  <span className="font-mono text-xs font-bold text-amber-400">
                    {composite.factors.derivativesScore}/25
                  </span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                  <div
                    className="h-full bg-amber-500 rounded-full"
                    style={{ width: `${(composite.factors.derivativesScore / 25) * 100}%` }}
                  />
                </div>
                <div className="text-[11px] text-zinc-400 space-y-1 font-mono">
                  <div className="flex justify-between">
                    <span>Funding 8j</span>
                    <span className="text-zinc-200">{number(funding?.fundingPercent, 4)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Annualized</span>
                    <span className="text-zinc-200">{t("Interval belum diverifikasi", "Interval unverified")}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Open Interest</span>
                    <span className="text-zinc-200">{number(interest?.quantity, 0)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Insider & Informed Flow Anomaly Radar */}
          {composite && (
            <div className="p-4 md:p-5 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 space-y-3">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-zinc-800/70 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
                    <Eye size={18} />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
                      <span>{t("Radar Anomali Transaksi Publik", "Public Trade Anomaly Radar")}</span>
                      <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${composite.informedFlow.badgeColor}`}>
                        {composite.informedFlow.typeLabel}
                      </span>
                    </h4>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      {t("Menandai ketimpangan sampel transaksi dan order book; identitas, niat pelaku, serta kaitan dengan berita tidak diketahui.", "Flags trade-sample and book imbalances; trader identity, intent and links to news are unknown.")}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-zinc-400">{t("Skor Anomali:", "Anomaly Score:")}</span>
                  <span className="text-base font-bold font-mono text-purple-400 bg-purple-500/10 px-2.5 py-0.5 rounded-lg border border-purple-500/20">
                    {composite.informedFlow.anomalyScore} / 100
                  </span>
                </div>
              </div>

              {/* 3 Detection Indicator Badges */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                <div className="p-2.5 rounded-xl bg-zinc-950/60 border border-zinc-800/60 text-xs font-mono space-y-1">
                  <span className="text-zinc-500 block">{t("Mega-Taker Bursts (≥$100k)", "Mega-Taker Bursts (≥$100k)")}</span>
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-zinc-200">{composite.informedFlow.megaTakerCount} {t("transaksi", "trades")}</span>
                    <span className={composite.informedFlow.megaTakerNetVolume >= 0 ? "text-emerald-400 font-semibold" : "text-rose-400 font-semibold"}>
                      {composite.informedFlow.megaTakerNetVolume >= 0 ? "+$" : "-$"}{Math.abs(Math.round(composite.informedFlow.megaTakerNetVolume)).toLocaleString()}
                    </span>
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-zinc-950/60 border border-zinc-800/60 text-xs font-mono space-y-1">
                  <span className="text-zinc-500 block">{t("Divergensi CVD", "CVD Divergence")}</span>
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-zinc-200">{composite.informedFlow.cvdDivergence ? t("AKTIF", "ACTIVE") : t("NETRAL", "NEUTRAL")}</span>
                    <span className={composite.informedFlow.cvdDivergence ? "text-emerald-400 text-[11px]" : "text-zinc-500 text-[11px]"}>
                      {composite.informedFlow.cvdDivergence ? t("Akumulasi Taker", "Taker Accumulation") : t("Sesuai Tren", "In-Line")}
                    </span>
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-zinc-950/60 border border-zinc-800/60 text-xs font-mono space-y-1">
                  <span className="text-zinc-500 block">{t("Kompresi Volatilitas (Pre-Breakout)", "Pre-Breakout Volatility Squeeze")}</span>
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-zinc-200">{composite.informedFlow.compressionActive ? t("TERKOMPRESI", "COMPRESSED") : t("NORMAL", "EXPANDED")}</span>
                    <span className="text-zinc-400 text-[11px]">
                      ATR {number(signals?.atrPercent, 2)}%
                    </span>
                  </div>
                </div>
              </div>

              {/* Research Explanation & Actionable Guidance */}
              <div className="p-3 rounded-xl bg-zinc-950/40 border border-zinc-800/60 space-y-1.5 text-xs">
                <p className="text-zinc-300 leading-relaxed font-sans">
                  {composite.informedFlow.explanation}
                </p>
                <p className="text-emerald-400 font-medium font-sans border-t border-zinc-800/60 pt-1.5">
                  💡 {composite.informedFlow.actionableGuidance}
                </p>
              </div>
            </div>
          )}

          {/* Macro Confluence Spotlight (When BTC is selected) */}
          {isBtc && whaleRadar.data && whaleRadar.data.etfSummary.ibit.btcHeld !== null && (
            <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/20 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-amber-400 inline-flex items-center gap-1.5 font-mono">
                  <Landmark size={15} />
                  <span>{t("Konfluensi Makro & ETF Institusional", "Macro Confluence & Institutional ETF Radar")}</span>
                </span>
                <span className="text-[11px] font-mono text-zinc-400">
                  {whaleRadar.data.etfSummary.institutionalSignal}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 text-xs font-mono">
                <div>
                  <span className="text-zinc-500">{t("Cadangan BlackRock (IBIT)", "BlackRock Reserves (IBIT)")}</span>
                  <div className="font-bold text-zinc-200">
                    {number(whaleRadar.data.etfSummary.ibit.btcHeld)} BTC
                  </div>
                </div>
                <div>
                  <span className="text-zinc-500">{t("Net Flow 5 Hari ETF AS", "US ETF 5-Day Net Flow")}</span>
                  <div className={`font-bold ${(whaleRadar.data.etfSummary.fiveDayNetFlowUsd ?? 0) >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                    {t("Belum tersedia", "Unavailable")}
                  </div>
                </div>
                <div>
                  <span className="text-zinc-500">{t("Skor Akumulasi Paus", "Whale Accumulation Score")}</span>
                  <div className="font-bold text-cyan-400">
                    {t("Belum tersedia", "Unavailable")}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Order Book Liquidity Wall Radar */}
          {depth && (depth.bidWall || depth.askWall) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 rounded-xl bg-zinc-900/40 border border-zinc-800">
              <div className="space-y-1">
                <div className="text-[11px] text-emerald-400 font-mono uppercase font-bold flex items-center gap-1">
                  <TrendingUp size={13} />
                  <span>{t("Dinding Beli Terbesar (Bid Support Wall)", "Largest Bid Support Wall")}</span>
                </div>
                {depth.bidWall ? (
                  <div className="text-xs font-mono text-zinc-300">
                    <span className="font-bold text-zinc-100">${depth.bidWall.price.toLocaleString()}</span>
                    <span className="text-zinc-500 ml-2">(${Math.round(depth.bidWall.value).toLocaleString()} USDT · -{depth.bidWall.distancePercent.toFixed(2)}%)</span>
                  </div>
                ) : (
                  <div className="text-xs text-zinc-500">{t("Tidak ada dinding terdeteksi", "No wall detected")}</div>
                )}
              </div>

              <div className="space-y-1">
                <div className="text-[11px] text-rose-400 font-mono uppercase font-bold flex items-center gap-1">
                  <TrendingDown size={13} />
                  <span>{t("Dinding Jual Terbesar (Ask Resistance Wall)", "Largest Ask Resistance Wall")}</span>
                </div>
                {depth.askWall ? (
                  <div className="text-xs font-mono text-zinc-300">
                    <span className="font-bold text-zinc-100">${depth.askWall.price.toLocaleString()}</span>
                    <span className="text-zinc-500 ml-2">(${Math.round(depth.askWall.value).toLocaleString()} USDT · +{depth.askWall.distancePercent.toFixed(2)}%)</span>
                  </div>
                ) : (
                  <div className="text-xs text-zinc-500">{t("Tidak ada dinding terdeteksi", "No wall detected")}</div>
                )}
              </div>
            </div>
          )}

          {/* Stale / Pending Data Alert */}
          {(flow.isPending || staleFlow || !!flow.data?.unavailable.length) && (
            <div role="status" className="intel-notice flex items-center gap-2 font-mono text-xs">
              {flow.isPending ? (
                <>
                  <RefreshCw size={13} className="desk-spin shrink-0 text-amber-400" />
                  <span>{t("Mengambil data live aliran pasar Binance…", "Acquiring live Binance market flow…")}</span>
                </>
              ) : (
                <>
                  <span>{t("Sebagian data tidak tersedia atau kedaluwarsa", "Some data is unavailable or stale")}</span>
                  {flow.data?.unavailable.length ? `: ${flow.data.unavailable.join(", ")}.` : ""}
                </>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Large-Trade & Whale Aggressor Radar */}
      <section className="desk-panel">
        <div className="desk-panel-head">
          <h2>{t("Radar Transaksi Besar & Agresor Paus", "Large-Trade & Whale Aggressor Radar")}</h2>
        </div>
        <div className="intel-body">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
            <label className="intel-field max-w-xs">
              <span className="text-xs text-zinc-300 font-mono">{t("Ambang Nilai USDT", "Notional Threshold USDT")}</span>
              <input
                type="number"
                min="0"
                step="10000"
                value={threshold}
                onChange={(e) => setThreshold(Math.max(0, Number(e.target.value)))}
                className="w-full"
              />
            </label>

            {trades && (
              <div className="flex items-center gap-4 text-xs font-mono p-2.5 rounded-lg bg-zinc-950/50 border border-zinc-800 self-start sm:self-auto">
                <div>
                  <span className="text-zinc-500">{t("Whale Beli:", "Whale Buys:")}</span>
                  <span className="font-bold text-emerald-400 ml-1.5">
                    ${Math.round(trades.whaleBuyValue).toLocaleString()}
                  </span>
                </div>
                <div>
                  <span className="text-zinc-500">{t("Whale Jual:", "Whale Sells:")}</span>
                  <span className="font-bold text-rose-400 ml-1.5">
                    ${Math.round(trades.whaleSellValue).toLocaleString()}
                  </span>
                </div>
              </div>
            )}
          </div>

          <p className="desk-muted">
            {trades
              ? `${trades.count} ${t("transaksi sampel terakhir", "latest trade sample")} (${new Date(trades.from).toLocaleTimeString()} – ${new Date(trades.to).toLocaleTimeString()}). ${trades.whaleTradesCount} ${t("transaksi whale di atas ambang.", "whale executions above threshold.")}`
              : t("Menunggu sampel transaksi terbaru dari bursa.", "Waiting for a recent trade sample from exchange.")}
          </p>

          {largeTrades.length ? (
            <div className="intel-table-wrap">
              <table className="intel-table">
                <thead>
                  <tr>
                    <th>{t("Waktu", "Time")}</th>
                    <th>{t("Agresor", "Aggressor")}</th>
                    <th>USDT Notional</th>
                    <th>{t("Kategori", "Tier")}</th>
                  </tr>
                </thead>
                <tbody>
                  {largeTrades.map((row) => (
                    <tr key={row.id}>
                      <td className="font-mono text-zinc-300">{new Date(row.time).toLocaleTimeString()}</td>
                      <td>
                        <span
                          className={`font-mono font-bold px-2 py-0.5 rounded text-[11px] ${
                            row.side === "buy"
                              ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                              : "bg-rose-500/15 text-rose-400 border border-rose-500/30"
                          }`}
                        >
                          {row.side === "buy" ? t("Beli (Aggressor)", "Buy (Aggressor)") : t("Jual (Aggressor)", "Sell (Aggressor)")}
                        </span>
                      </td>
                      <td className="font-mono font-bold text-zinc-100">${number(row.value)}</td>
                      <td className="text-xs font-mono text-zinc-400">
                        {row.value >= 250000 ? "🐋 Mega Whale" : row.value >= 100000 ? "🦈 Institutional" : "🐬 Whale"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p role="status" className="text-zinc-500 text-xs">
              {trades
                ? t("Tidak ada transaksi melewati ambang dalam sampel 500 transaksi terakhir.", "No trades exceed the threshold in this 500-trade sample.")
                : t("Data transaksi tidak tersedia.", "Trade data unavailable.")}
            </p>
          )}
        </div>
      </section>

      {/* Spot / Long Risk Plan (Position Sizer) */}
      <section className="desk-panel">
        <div className="desk-panel-head flex-wrap gap-2">
          <div>
            <span className="desk-eyebrow">{t("Kalkulator Manajemen Risiko", "Risk Management Desk")}</span>
            <h2>{t("Rencana Posisi Spot & Manajemen Modal", "Spot Position & Risk Budgeting Plan")}</h2>
          </div>
          <button
            type="button"
            className="desk-button cursor-pointer shrink-0"
            disabled={staleCandles || !signals || signals.atr <= 0 || signals.last.close <= signals.atr * 2}
            onClick={() => {
              if (signals) {
                setInput((s) => ({
                  ...s,
                  entry: signals.last.close,
                  stop: signals.last.close - signals.atr * 2,
                  target: signals.last.close + signals.atr * 4,
                }));
              }
            }}
          >
            {t("Isi skenario 2 ATR", "Fill 2 ATR scenario")}
          </button>
        </div>

        <div className="intel-body">
          <p className="text-xs text-zinc-400 leading-relaxed">
            {t(
              "Semua nilai dalam USDT. Perhitungan mempertimbangkan modal terpakai, anggaran risiko, fee 2 sisi, serta perkiraan slippage eksekusi.",
              "All amounts in USDT. Calculation models capital used, risk budget, two-sided fees, and estimated execution slippage."
            )}
          </p>

          <div className="intel-form">
            <label className="intel-field">
              {t("Modal USDT", "Capital USDT")}
              <input
                type="number"
                step="any"
                min="0"
                value={Number.isNaN(input.capital) ? "" : input.capital}
                onChange={(e) => setInput((s) => ({ ...s, capital: e.target.value === "" ? NaN : Number(e.target.value) }))}
              />
            </label>
            <label className="intel-field">
              {t("Risiko per posisi %", "Risk per position %")}
              <input
                type="number"
                step="any"
                min="0"
                value={Number.isNaN(input.riskPercent) ? "" : input.riskPercent}
                onChange={(e) => setInput((s) => ({ ...s, riskPercent: e.target.value === "" ? NaN : Number(e.target.value) }))}
              />
            </label>
            <label className="intel-field">
              Entry USDT
              <input
                type="number"
                step="any"
                min="0"
                value={Number.isNaN(input.entry) ? "" : input.entry}
                onChange={(e) => setInput((s) => ({ ...s, entry: e.target.value === "" ? NaN : Number(e.target.value) }))}
              />
            </label>
            <label className="intel-field">
              Stop Loss USDT
              <input
                type="number"
                step="any"
                min="0"
                value={Number.isNaN(input.stop) ? "" : input.stop}
                onChange={(e) => setInput((s) => ({ ...s, stop: e.target.value === "" ? NaN : Number(e.target.value) }))}
              />
            </label>
            <label className="intel-field">
              Target Profit USDT
              <input
                type="number"
                step="any"
                min="0"
                value={Number.isNaN(input.target) ? "" : input.target}
                onChange={(e) => setInput((s) => ({ ...s, target: e.target.value === "" ? NaN : Number(e.target.value) }))}
              />
            </label>
            <label className="intel-field">
              {t("Fee per sisi %", "Fee per side %")}
              <input
                type="number"
                step="any"
                min="0"
                value={Number.isNaN(input.feePercent) ? "" : input.feePercent}
                onChange={(e) => setInput((s) => ({ ...s, feePercent: e.target.value === "" ? NaN : Number(e.target.value) }))}
              />
            </label>
            <label className="intel-field">
              {t("Slippage per sisi %", "Slippage per side %")}
              <input
                type="number"
                step="any"
                min="0"
                value={Number.isNaN(input.slippagePercent) ? "" : input.slippagePercent}
                onChange={(e) => setInput((s) => ({ ...s, slippagePercent: e.target.value === "" ? NaN : Number(e.target.value) }))}
              />
            </label>
            <label className="intel-field">
              {t("Langkah kuantitas bursa", "Quantity step (exchange)")}
              <input
                type="number"
                step="any"
                min="0"
                value={Number.isNaN(input.lotSize) ? "" : input.lotSize}
                onChange={(e) => setInput((s) => ({ ...s, lotSize: e.target.value === "" ? NaN : Number(e.target.value) }))}
              />
            </label>
          </div>

          {plan ? (
            <>
              <dl className="intel-metrics">
                <div>
                  <dt>{t("Kuantitas aset", "Asset quantity")}</dt>
                  <dd>{number(plan.quantity, 6)}</dd>
                </div>
                <div>
                  <dt>{t("Modal terpakai", "Capital used")}</dt>
                  <dd>${number(plan.capitalUsed)}</dd>
                </div>
                <div>
                  <dt>{t("Rugi pada stop*", "Loss at stop*")}</dt>
                  <dd className="text-rose-400">-${number(plan.plannedLoss)}</dd>
                </div>
                <div>
                  <dt>{t("Profit pada target*", "Profit at target*")}</dt>
                  <dd className="text-emerald-400">+${number(plan.plannedProfit)}</dd>
                </div>
                <div>
                  <dt>Reward / Risk</dt>
                  <dd className={plan.rewardRisk >= 2 ? "text-emerald-400 font-bold" : "text-amber-400"}>
                    {number(plan.rewardRisk)}×
                  </dd>
                </div>
                <div>
                  <dt>Break-even</dt>
                  <dd>${number(plan.breakEven, 4)}</dd>
                </div>
              </dl>

              {(plan.quantity === 0 || plan.rewardRisk < 2) && (
                <p className="intel-notice">
                  {plan.quantity === 0
                    ? t("Modal atau anggaran risiko tidak mencukupi untuk minimum langkah kuantitas bursa.", "Capital or risk budget is too small for this quantity step.")
                    : t("Reward/risk bersih di bawah 2×. Disarankan mengevaluasi kembali jarak stop dan target profit.", "Net reward/risk is below 2×. Review stop and target distances.")}
                </p>
              )}
            </>
          ) : (
            <p role="status" className="text-zinc-500 text-xs">
              {t(
                "Isi modal positif, risiko 0–100%, serta kondisi: 0 < Stop Loss < Entry < Target Profit. Biaya fee + slippage harus di bawah 100%.",
                "Enter positive capital, risk 0–100%, and valid prices: 0 < Stop Loss < Entry < Target Profit."
              )}
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
