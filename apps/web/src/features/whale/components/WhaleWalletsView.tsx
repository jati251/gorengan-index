"use client";

import { useState } from "react";
import { ExternalLink, Copy, Check, Activity, ArrowUpRight, ArrowDownLeft, RefreshCw, ShieldAlert, Wallet } from "lucide-react";
import type { WhaleCategory, WhaleRadarData } from "../types";
import { formatBtc, formatUsd, formatPercent, getWhaleCategoryBadge } from "../utils/formatters";
import { useTranslation } from "@/features/i18n";

interface WhaleWalletsViewProps {
  data: WhaleRadarData;
}

export function WhaleWalletsView({ data }: WhaleWalletsViewProps) {
  const { locale } = useTranslation();
  const id = locale === "id";
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<WhaleCategory | "ALL">("ALL");

  const { whaleEntities, recentLargeTxs, stats, btcPrice } = data;

  const handleCopy = (address: string) => {
    void navigator.clipboard.writeText(address);
    setCopiedAddress(address);
    setTimeout(() => setCopiedAddress(null), 2000);
  };

  const filteredEntities = selectedCategory === "ALL"
    ? whaleEntities
    : whaleEntities.filter((w) => w.category === selectedCategory);

  const categories: { key: WhaleCategory | "ALL"; label: string }[] = [
    { key: "ALL", label: id ? "Semua Entitas" : "All Whales" },
    { key: "INSTITUTION", label: id ? "Institusi ETF" : "Institutions" },
    { key: "CORPORATE", label: id ? "Korporasi" : "Corporates" },
    { key: "EXCHANGE", label: id ? "Bursa Kripto" : "Exchanges" },
    { key: "GOVERNMENT", label: id ? "Pemerintah" : "Governments" },
    { key: "FOUNDER", label: id ? "Genesis / Satoshi" : "Genesis" },
  ];

  return (
    <div className="space-y-6">
      {/* Top Stats Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800/80 backdrop-blur-md">
          <div className="flex items-center justify-between text-xs text-zinc-400 font-mono mb-1">
            <span>{id ? "Total Cadangan Paus Terlacak" : "Total Tracked Whale Reserves"}</span>
            <Wallet size={16} className="text-amber-400" />
          </div>
          <div className="text-xl font-bold font-mono text-zinc-100">
            {formatBtc(stats.topWhalesHoldingsBtc, 0)}
          </div>
          <div className="text-xs text-zinc-500 mt-1">
            {formatUsd(stats.topWhalesHoldingsBtc * btcPrice, true)} · {id ? "Valuasi pasar" : "Market value"}
          </div>
        </div>

        <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800/80 backdrop-blur-md">
          <div className="flex items-center justify-between text-xs text-zinc-400 font-mono mb-1">
            <span>{id ? "Pangsa Pasokan Beredar" : "Share of Circulating Supply"}</span>
            <Activity size={16} className="text-cyan-400" />
          </div>
          <div className="text-xl font-bold font-mono text-cyan-400">
            {formatPercent(stats.topWhalesSupplySharePercent, false)}
          </div>
          <div className="text-xs text-zinc-500 mt-1">
            {id ? "Dari 19.85 Juta BTC yang telah ditambang" : "Of 19.85M BTC currently mined"}
          </div>
        </div>

        <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800/80 backdrop-blur-md">
          <div className="flex items-center justify-between text-xs text-zinc-400 font-mono mb-1">
            <span>{id ? "Skor Akumulasi On-Chain" : "On-Chain Accumulation Score"}</span>
            <ShieldAlert size={16} className="text-emerald-400" />
          </div>
          <div className="text-xl font-bold font-mono text-emerald-400 flex items-center gap-2">
            <span>{stats.accumulationScore} / 100</span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">
              {stats.marketSentiment}
            </span>
          </div>
          <div className="text-xs text-zinc-500 mt-1">
            {id ? "Aliran dana keluar dari bursa ke brankas dingin" : "Net outflows from exchanges to cold vaults"}
          </div>
        </div>
      </div>

      {/* Main Table: Known Whale Reserves */}
      <div className="p-5 rounded-2xl bg-zinc-900/40 border border-zinc-800/80 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h4 className="text-sm font-bold text-zinc-200">
              {id ? "Daftar Brankas Paus & Institusi Bitcoin Terbesar" : "Top Bitcoin Whale & Institutional Reserves"}
            </h4>
            <p className="text-xs text-zinc-500 mt-0.5">
              {id ? "Dompet on-chain terverifikasi milik pendiri, ETF, bursa, korporasi, dan lembaga negara" : "Verified on-chain wallets belonging to founders, ETFs, exchanges, corporates, and sovereigns"}
            </p>
          </div>

          {/* Category Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-xl bg-zinc-950/80 border border-zinc-800">
            {categories.map((cat) => (
              <button
                key={cat.key}
                type="button"
                onClick={() => setSelectedCategory(cat.key)}
                className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-colors cursor-pointer ${
                  selectedCategory === cat.key
                    ? "bg-zinc-800 text-zinc-100 shadow-sm"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Entities Table */}
        <div className="overflow-x-auto rounded-xl border border-zinc-800">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-zinc-950/80 text-zinc-400 border-b border-zinc-800 font-mono text-[11px]">
                <th className="py-2.5 px-3">{id ? "Entitas Paus" : "Whale Entity"}</th>
                <th className="py-2.5 px-3">{id ? "Kategori" : "Category"}</th>
                <th className="py-2.5 px-3">{id ? "Alamat Dompet Utama" : "Primary Address"}</th>
                <th className="py-2.5 px-3">{id ? "Saldo BTC" : "BTC Balance"}</th>
                <th className="py-2.5 px-3">{id ? "Valuasi USD" : "USD Valuation"}</th>
                <th className="py-2.5 px-3">{id ? "% Pasokan" : "% Supply"}</th>
                <th className="py-2.5 px-3 text-right">{id ? "Aktivitas Terakhir" : "Last Active"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60 font-mono">
              {filteredEntities.map((whale) => {
                const badge = getWhaleCategoryBadge(whale.category, id);
                return (
                  <tr key={whale.id} className="hover:bg-zinc-800/30 transition-colors">
                    <td className="py-2.5 px-3">
                      <div className="font-bold text-zinc-200 flex items-center gap-1.5">
                        <span>{whale.name}</span>
                        {whale.verified && (
                          <span className="text-amber-400 text-[10px] font-sans px-1 rounded bg-amber-500/10 border border-amber-500/20">
                            ✓ Verified
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-zinc-500 font-sans mt-0.5">
                        {whale.labelNote}
                      </div>
                    </td>

                    <td className="py-2.5 px-3">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${badge.bg} ${badge.text} ${badge.border}`}>
                        {badge.label}
                      </span>
                    </td>

                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-1.5">
                        <span className="text-zinc-300 font-mono">{whale.addressShort}</span>
                        <button
                          type="button"
                          onClick={() => handleCopy(whale.address)}
                          aria-label={`Copy address ${whale.addressShort}`}
                          className="p-1 rounded hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
                        >
                          {copiedAddress === whale.address ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                        </button>
                        {whale.explorerUrl && (
                          <a
                            href={whale.explorerUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={`View ${whale.name} in Bitcoin Explorer`}
                            className="p-1 rounded hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 transition-colors"
                          >
                            <ExternalLink size={12} />
                          </a>
                        )}
                      </div>
                    </td>

                    <td className="py-2.5 px-3 font-bold text-zinc-100">
                      {formatBtc(whale.balanceBtc, 0)}
                    </td>

                    <td className="py-2.5 px-3 font-semibold text-emerald-400">
                      {formatUsd(whale.balanceUsd, true)}
                    </td>

                    <td className="py-2.5 px-3 text-cyan-400">
                      {formatPercent(whale.shareOfCirculatingSupply, false)}
                    </td>

                    <td className="py-2.5 px-3 text-right text-zinc-400 text-[11px] font-sans">
                      {whale.lastActiveDate ?? "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Live Large On-Chain Transactions Feed */}
      <div className="p-5 rounded-2xl bg-zinc-900/40 border border-zinc-800/80 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-bold text-zinc-200 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>{id ? "Radar Transaksi Besar On-Chain (>15 BTC / >$1.3 Juta)" : "Live Large On-Chain Transactions (>15 BTC / >$1.3M)"}</span>
            </h4>
            <p className="text-xs text-zinc-500 mt-0.5">
              {id ? "Aliran transaksi Bitcoin langsung dari jaringan publik mempool & blockchain" : "Real-time Bitcoin transfers queried live from public mempool & blocks"}
            </p>
          </div>
          <span className="text-[11px] font-mono text-zinc-400 px-2 py-0.5 rounded bg-zinc-800/60 border border-zinc-700/60">
            {recentLargeTxs.length} {id ? "Transaksi Terdeteksi" : "Transactions"}
          </span>
        </div>

        {/* Transactions Feed */}
        <div className="space-y-2.5">
          {recentLargeTxs.map((tx) => {
            const isOutflow = tx.type === "OUTFLOW";
            const isInflow = tx.type === "INFLOW";

            return (
              <div
                key={tx.txid}
                className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-zinc-950/60 border border-zinc-800/70 hover:border-zinc-700/70 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`p-2 rounded-lg border ${
                      isOutflow
                        ? "bg-rose-500/10 text-rose-400 border-rose-500/20"
                        : isInflow
                        ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                        : "bg-blue-500/10 text-blue-400 border-blue-500/20"
                    }`}
                  >
                    {isOutflow ? <ArrowUpRight size={18} /> : isInflow ? <ArrowDownLeft size={18} /> : <RefreshCw size={18} />}
                  </div>

                  <div>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-bold text-zinc-200">{tx.senderLabel}</span>
                      <span className="text-zinc-500">→</span>
                      <span className="font-bold text-zinc-200">{tx.receiverLabel}</span>
                      <span className={`text-[10px] font-semibold px-1.5 py-0.2 rounded font-mono ${
                        isOutflow ? "text-rose-400 bg-rose-500/10" : isInflow ? "text-amber-400 bg-amber-500/10" : "text-blue-400 bg-blue-500/10"
                      }`}>
                        {tx.type}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-[11px] text-zinc-500 font-mono mt-0.5">
                      <span>TX: {tx.txidShort}</span>
                      <span>·</span>
                      <span>{new Date(tx.timestamp).toLocaleTimeString()}</span>
                      <span>·</span>
                      <span>Fee: {tx.feeBtc.toFixed(5)} BTC</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 self-end sm:self-auto">
                  <div className="text-right font-mono">
                    <div className="text-sm font-bold text-zinc-100">
                      {formatBtc(tx.amountBtc, 2)}
                    </div>
                    <div className="text-[11px] text-emerald-400">
                      {formatUsd(tx.amountUsd, true)}
                    </div>
                  </div>

                  <a
                    href={tx.explorerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Open Bitcoin transaction ${tx.txidShort} in mempool.space`}
                    className="p-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
                  >
                    <ExternalLink size={14} />
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
