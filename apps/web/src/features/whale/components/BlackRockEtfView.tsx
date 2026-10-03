"use client";

import { ArrowUpRight, TrendingUp, TrendingDown, ShieldCheck, Landmark, Building2, BarChart2, Coins } from "lucide-react";
import type { WhaleRadarData } from "../types";
import { formatBtc, formatUsd, formatPercent, formatFlow, getSignalBadge } from "../utils/formatters";
import { useTranslation } from "@/features/i18n";
import { useMarketStore } from "@/stores/marketStore";
import { useWorkspaceStore } from "@/stores/workspaceStore";

interface BlackRockEtfViewProps {
  data: WhaleRadarData;
}

export function BlackRockEtfView({ data }: BlackRockEtfViewProps) {
  const { locale } = useTranslation();
  const id = locale === "id";
  const setSelectedSymbol = useMarketStore((s) => s.setSelectedSymbol);
  const openWorkspace = useWorkspaceStore((s) => s.open);

  const { etfSummary } = data;
  const ibit = etfSummary.ibit;
  const signal = getSignalBadge(etfSummary.institutionalSignal, id);

  const handleSelectSymbol = (symbolId: string) => {
    setSelectedSymbol(symbolId);
    openWorkspace("chart");
  };

  return (
    <div className="space-y-6">
      {/* Top Banner: Institutional Sentiment Signal */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-4 rounded-xl bg-zinc-900/60 border border-zinc-800/80 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400">
            <Landmark size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono tracking-wider uppercase text-zinc-400">
                {id ? "Sinyal Sentimen Institusional" : "Institutional Sentiment Signal"}
              </span>
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${signal.color}`}>
                {signal.label}
              </span>
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">{signal.desc}</p>
          </div>
        </div>

        <div className="flex items-center gap-6 self-stretch md:self-auto justify-between md:justify-end border-t md:border-t-0 pt-3 md:pt-0 border-zinc-800">
          <div>
            <div className="text-[11px] text-zinc-500 uppercase font-mono">
              {id ? "Net Flow 5 Hari" : "5-Day Net Inflow"}
            </div>
            <div className={`text-base font-semibold font-mono ${etfSummary.fiveDayNetFlowUsd >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
              {formatFlow(etfSummary.fiveDayNetFlowUsd)}
            </div>
          </div>
          <div>
            <div className="text-[11px] text-zinc-500 uppercase font-mono">
              {id ? "Porsi Pasokan BTC" : "BTC Supply Share"}
            </div>
            <div className="text-base font-semibold font-mono text-cyan-400">
              {formatPercent(etfSummary.totalBtcSupplySharePercent, false)}
            </div>
          </div>
        </div>
      </div>

      {/* Hero Card: BlackRock IBIT Spotlight */}
      <div className="p-5 md:p-6 rounded-2xl bg-gradient-to-br from-zinc-900 via-zinc-900/90 to-zinc-950 border border-zinc-800 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5">
              <span className="px-2.5 py-1 text-xs font-bold rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30 font-mono">
                NASDAQ: IBIT
              </span>
              <span className="text-xs text-zinc-400 font-medium">
                {ibit.issuer} · {ibit.custodian}
              </span>
            </div>
            <h3 className="text-xl md:text-2xl font-bold text-zinc-100 tracking-tight">
              {ibit.name}
            </h3>
            <p className="text-xs text-zinc-400 max-w-xl leading-relaxed">
              {id
                ? "ETF Bitcoin spot terbesar di dunia yang dikelola oleh BlackRock. Menyimpan Bitcoin fisik 1:1 di brankas terpisah Coinbase Prime Institutional Custody."
                : "The world's largest spot Bitcoin ETF operated by BlackRock. Holds 1:1 physically backed Bitcoin in segregated Coinbase Prime Institutional cold vaults."}
            </p>
          </div>

          {/* IBIT Quote Details */}
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-4 bg-zinc-950/70 p-4 rounded-xl border border-zinc-800/80">
            <div>
              <div className="text-[11px] font-mono uppercase text-zinc-500">
                {id ? "Harga Pasar (USD)" : "Market Price (USD)"}
              </div>
              <div className="text-2xl font-bold font-mono text-zinc-100">
                ${ibit.price.toFixed(2)}
              </div>
            </div>

            <div className="border-l border-zinc-800 pl-4">
              <div className="text-[11px] font-mono uppercase text-zinc-500">
                {id ? "Perubahan 24j" : "24h Change"}
              </div>
              <div className={`text-base font-bold font-mono flex items-center gap-1 ${ibit.change24h >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                {ibit.change24h >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                <span>{formatPercent(ibit.changePercent24h)}</span>
                <span className="text-xs font-normal opacity-70">(${ibit.change24h.toFixed(2)})</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => handleSelectSymbol(ibit.tickerId)}
              className="ml-auto px-3.5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs flex items-center gap-1.5 transition-colors shadow-lg shadow-amber-500/10 cursor-pointer"
            >
              <span>{id ? "Lihat Chart" : "View Chart"}</span>
              <ArrowUpRight size={14} />
            </button>
          </div>
        </div>

        {/* 4 Core BlackRock Reserves Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mt-6 pt-6 border-t border-zinc-800/80">
          <div className="p-3.5 rounded-xl bg-zinc-950/50 border border-zinc-800/50">
            <div className="flex items-center gap-1.5 text-zinc-400 text-xs mb-1">
              <Coins size={14} className="text-amber-400" />
              <span>{id ? "Cadangan BTC BlackRock" : "BlackRock BTC Reserves"}</span>
            </div>
            <div className="text-lg md:text-xl font-bold font-mono text-zinc-100">
              {formatBtc(ibit.btcHeld, 0)}
            </div>
            <div className="text-[11px] text-zinc-500 mt-0.5">
              ~{((ibit.btcHeld / data.stats.circulatingSupplyBtc) * 100).toFixed(2)}% {id ? "dari pasokan BTC" : "of BTC supply"}
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-zinc-950/50 border border-zinc-800/50">
            <div className="flex items-center gap-1.5 text-zinc-400 text-xs mb-1">
              <BarChart2 size={14} className="text-emerald-400" />
              <span>{id ? "Total AUM (Dana Kelolaan)" : "Total AUM"}</span>
            </div>
            <div className="text-lg md:text-xl font-bold font-mono text-zinc-100">
              {formatUsd(ibit.aumUsd, true)}
            </div>
            <div className="text-[11px] text-zinc-500 mt-0.5">
              ${(ibit.aumUsd / 1_000_000_000).toFixed(2)} {id ? "Miliar USD" : "Billion USD"}
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-zinc-950/50 border border-zinc-800/50">
            <div className="flex items-center gap-1.5 text-zinc-400 text-xs mb-1">
              <Building2 size={14} className="text-blue-400" />
              <span>{id ? "Volume Transaksi 24h" : "24h Trading Volume"}</span>
            </div>
            <div className="text-lg md:text-xl font-bold font-mono text-zinc-100">
              {ibit.volume24h.toLocaleString("en-US")}
            </div>
            <div className="text-[11px] text-zinc-500 mt-0.5">
              {id ? "Saham berpindah tangan" : "Shares traded"}
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-zinc-950/50 border border-zinc-800/50">
            <div className="flex items-center gap-1.5 text-zinc-400 text-xs mb-1">
              <ShieldCheck size={14} className="text-purple-400" />
              <span>{id ? "Rasio Biaya & Kustodian" : "Expense & Custodian"}</span>
            </div>
            <div className="text-lg md:text-xl font-bold font-mono text-zinc-100">
              {ibit.expenseRatio.toFixed(2)}%
            </div>
            <div className="text-[11px] text-zinc-500 mt-0.5">
              Coinbase Prime Cold Vault
            </div>
          </div>
        </div>
      </div>

      {/* Grid: Daily Net Flows Table & Supply Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: ETF Net Flows History (2 cols) */}
        <div className="lg:col-span-2 p-5 rounded-2xl bg-zinc-900/40 border border-zinc-800/80 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-bold text-zinc-200">
                {id ? "Riwayat Arus Modal Bersih Harian (Net Inflow/Outflow)" : "Daily Net Flow History (US Spot ETFs)"}
              </h4>
              <p className="text-xs text-zinc-500 mt-0.5">
                {id ? "Arus modal masuk & keluar bersih harian dalam Juta USD ($M)" : "Daily net capital inflow and outflow in Millions USD ($M)"}
              </p>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto rounded-xl border border-zinc-800">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-zinc-950/80 text-zinc-400 border-b border-zinc-800 font-mono text-[11px]">
                  <th className="py-2.5 px-3">{id ? "Tanggal" : "Date"}</th>
                  <th className="py-2.5 px-3">BlackRock (IBIT)</th>
                  <th className="py-2.5 px-3">Fidelity (FBTC)</th>
                  <th className="py-2.5 px-3">{id ? "Total Semua Spot ETF" : "Total All Spot ETFs"}</th>
                  <th className="py-2.5 px-3 text-right">{id ? "Harga BTC Ref" : "BTC Ref Price"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60 font-mono">
                {etfSummary.recentFlows.map((flow) => {
                  const isPositive = flow.totalNetFlowUsd >= 0;
                  return (
                    <tr key={flow.date} className="hover:bg-zinc-800/30 transition-colors">
                      <td className="py-2.5 px-3 text-zinc-300 font-medium">{flow.date}</td>
                      <td className={`py-2.5 px-3 ${flow.ibitFlowUsd >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                        {formatFlow(flow.ibitFlowUsd)}
                      </td>
                      <td className={`py-2.5 px-3 ${flow.fbtcFlowUsd >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                        {formatFlow(flow.fbtcFlowUsd)}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className={`inline-flex items-center gap-1 font-bold ${isPositive ? "text-emerald-400" : "text-rose-400"}`}>
                          {formatFlow(flow.totalNetFlowUsd)}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right text-zinc-400">
                        ${flow.btcPrice.toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: Supply Dominance Visualizer */}
        <div className="p-5 rounded-2xl bg-zinc-900/40 border border-zinc-800/80 space-y-4 flex flex-col justify-between">
          <div>
            <h4 className="text-sm font-bold text-zinc-200">
              {id ? "Dominasi Cadangan Spot ETF" : "Spot ETF Supply Dominance"}
            </h4>
            <p className="text-xs text-zinc-500 mt-0.5">
              {id ? "Akumulasi kepemilikan ETF terhadap 21 Juta BTC" : "Cumulative ETF holdings vs 21 Million max supply"}
            </p>

            <div className="mt-6 space-y-4">
              <div>
                <div className="flex justify-between text-xs font-mono mb-1.5">
                  <span className="text-amber-400 font-medium">BlackRock IBIT</span>
                  <span className="text-zinc-300">{formatBtc(ibit.btcHeld, 0)}</span>
                </div>
                <div className="w-full h-2 rounded-full bg-zinc-800 overflow-hidden">
                  <div
                    className="h-full bg-amber-400 rounded-full"
                    style={{ width: `${(ibit.btcHeld / etfSummary.totalBtcReserves) * 100}%` }}
                  />
                </div>
                <div className="text-[10px] text-zinc-500 mt-1 flex justify-between">
                  <span>{((ibit.btcHeld / etfSummary.totalBtcReserves) * 100).toFixed(1)}% {id ? "dari total ETF" : "of total ETF reserves"}</span>
                  <span>{formatUsd(ibit.aumUsd, true)}</span>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-mono mb-1.5">
                  <span className="text-cyan-400 font-medium">Fidelity (FBTC)</span>
                  <span className="text-zinc-300">{formatBtc(etfSummary.allEtfs[1]?.btcHeld ?? 195840, 0)}</span>
                </div>
                <div className="w-full h-2 rounded-full bg-zinc-800 overflow-hidden">
                  <div
                    className="h-full bg-cyan-400 rounded-full"
                    style={{ width: `${((etfSummary.allEtfs[1]?.btcHeld ?? 195840) / etfSummary.totalBtcReserves) * 100}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-mono mb-1.5">
                  <span className="text-purple-400 font-medium">Grayscale (GBTC)</span>
                  <span className="text-zinc-300">{formatBtc(etfSummary.allEtfs[4]?.btcHeld ?? 212500, 0)}</span>
                </div>
                <div className="w-full h-2 rounded-full bg-zinc-800 overflow-hidden">
                  <div
                    className="h-full bg-purple-400 rounded-full"
                    style={{ width: `${((etfSummary.allEtfs[4]?.btcHeld ?? 212500) / etfSummary.totalBtcReserves) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-zinc-950/60 border border-zinc-800/60 text-xs space-y-1.5 mt-4">
            <div className="flex justify-between font-mono">
              <span className="text-zinc-400">{id ? "Total Cadangan ETF" : "Total ETF Reserves"}</span>
              <span className="font-bold text-zinc-100">{formatBtc(etfSummary.totalBtcReserves, 0)}</span>
            </div>
            <div className="flex justify-between font-mono">
              <span className="text-zinc-400">{id ? "Total AUM Gabungan" : "Combined AUM"}</span>
              <span className="font-bold text-emerald-400">{formatUsd(etfSummary.totalAumUsd, true)}</span>
            </div>
            <div className="flex justify-between font-mono">
              <span className="text-zinc-400">{id ? "Pangsa Pasokan Beredar" : "Share of Circulating"}</span>
              <span className="font-bold text-cyan-400">{formatPercent(etfSummary.totalBtcSupplySharePercent, false)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Top 5 US Spot Bitcoin ETFs Comparison Table */}
      <div className="p-5 rounded-2xl bg-zinc-900/40 border border-zinc-800/80 space-y-4">
        <h4 className="text-sm font-bold text-zinc-200">
          {id ? "Perbandingan 5 ETF Bitcoin Spot Terbesar di AS" : "Top 5 US Spot Bitcoin ETFs Comparison"}
        </h4>

        <div className="overflow-x-auto rounded-xl border border-zinc-800">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-zinc-950/80 text-zinc-400 border-b border-zinc-800 font-mono text-[11px]">
                <th className="py-2.5 px-3">Ticker / {id ? "Nama" : "Name"}</th>
                <th className="py-2.5 px-3">{id ? "Penerbit" : "Issuer"}</th>
                <th className="py-2.5 px-3">{id ? "Harga" : "Price"}</th>
                <th className="py-2.5 px-3">{id ? "Perubahan 24j" : "24h Change"}</th>
                <th className="py-2.5 px-3">{id ? "Cadangan BTC" : "BTC Held"}</th>
                <th className="py-2.5 px-3">AUM (USD)</th>
                <th className="py-2.5 px-3">{id ? "Biaya" : "Fee"}</th>
                <th className="py-2.5 px-3 text-right">{id ? "Aksi" : "Action"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60 font-mono">
              {etfSummary.allEtfs.map((etf) => (
                <tr key={etf.symbol} className="hover:bg-zinc-800/30 transition-colors">
                  <td className="py-2.5 px-3">
                    <div className="font-bold text-zinc-200">{etf.symbol}</div>
                    <div className="text-[10px] text-zinc-500 font-sans">{etf.name}</div>
                  </td>
                  <td className="py-2.5 px-3 text-zinc-400 font-sans">{etf.issuer}</td>
                  <td className="py-2.5 px-3 font-bold text-zinc-100">${etf.price.toFixed(2)}</td>
                  <td className={`py-2.5 px-3 font-semibold ${etf.change24h >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                    {formatPercent(etf.changePercent24h)}
                  </td>
                  <td className="py-2.5 px-3 text-zinc-200">{formatBtc(etf.btcHeld, 0)}</td>
                  <td className="py-2.5 px-3 text-zinc-300">{formatUsd(etf.aumUsd, true)}</td>
                  <td className="py-2.5 px-3 text-zinc-400">{etf.expenseRatio.toFixed(2)}%</td>
                  <td className="py-2.5 px-3 text-right">
                    <button
                      type="button"
                      onClick={() => handleSelectSymbol(etf.tickerId)}
                      className="px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[11px] font-sans inline-flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <span>Chart</span>
                      <ArrowUpRight size={12} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
