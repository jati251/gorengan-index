"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Landmark, Wallet, RefreshCw, AlertCircle, Sparkles, Coins, MessageSquareQuote, FileText } from "lucide-react";
import { useWhaleRadarQuery } from "../api/useWhaleRadarQuery";
import { BlackRockEtfView } from "./BlackRockEtfView";
import { WhaleWalletsView } from "./WhaleWalletsView";
import { CommoditiesRadarView } from "./CommoditiesRadarView";
import { XVipSocialView } from "./XVipSocialView";
import { useTranslation } from "@/features/i18n";
import { SourceStatus } from "./SourceStatus";
import { InsiderFilingsView } from "@/features/insider/components/InsiderFilingsView";
import { formatUsd } from "../utils/formatters";

type RadarTab = "etf" | "whales" | "commodities" | "social" | "insider";

function RadarScannerLoader({ id }: { id: boolean }) {
  return (
    <div className="py-8 px-4 flex flex-col items-center justify-center text-center space-y-6" role="status" aria-label="Loading radar data">
      {/* High-tech animated radar scanner */}
      <div className="relative w-36 h-36 flex items-center justify-center">
        {/* Outermost sonar wave */}
        <div className="absolute inset-0 rounded-full border border-amber-500/20 animate-[ping_2.8s_cubic-bezier(0,0,0.2,1)_infinite]" />
        {/* Static concentric grid rings */}
        <div className="absolute inset-2 rounded-full border border-amber-500/25" />
        <div className="absolute inset-6 rounded-full border border-amber-500/35" />
        <div className="absolute inset-10 rounded-full border border-dashed border-amber-500/40 animate-[spin_16s_linear_infinite]" />
        {/* Radar crosshairs */}
        <div className="absolute inset-x-0 top-1/2 h-px bg-amber-500/20" />
        <div className="absolute inset-y-0 left-1/2 w-px bg-amber-500/20" />
        {/* Rotating sweep cone */}
        <div
          className="absolute inset-0 rounded-full animate-[spin_2.2s_linear_infinite]"
          style={{
            background: "conic-gradient(from 0deg, transparent 0deg, rgba(244, 196, 27, 0.05) 300deg, rgba(244, 196, 27, 0.45) 360deg)",
          }}
        />
        {/* Center glowing radar beacon */}
        <div className="relative z-10 w-3.5 h-3.5 rounded-full bg-amber-400 shadow-[0_0_14px_rgba(244,196,27,0.9)] animate-pulse" />
      </div>

      {/* Status Typography */}
      <div className="space-y-1.5 font-mono">
        <div className="text-sm font-bold text-amber-400 flex items-center justify-center gap-2 tracking-wide">
          <span>{id ? "MEMINDAI ON-CHAIN & DOKUMEN INSTITUSI" : "SCANNING ON-CHAIN & INSTITUTIONAL INTEL"}</span>
          <span className="flex gap-1" aria-hidden="true">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: "0ms" }} />
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: "150ms" }} />
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: "300ms" }} />
          </span>
        </div>
        <p className="text-xs text-zinc-400 max-w-md mx-auto">
          {id
            ? "Membaca mempool Bitcoin, kuotasi komoditas real-time, cadangan IBIT BlackRock, dan berita publik..."
            : "Acquiring Bitcoin mempool transfers, live commodity spot, BlackRock IBIT reserves & wire feeds..."}
        </p>
      </div>

      {/* Placeholder ghost cards */}
      <div className="grid gap-3 sm:grid-cols-2 w-full max-w-2xl pt-2">
        <div className="p-4 rounded-xl border border-zinc-800/80 bg-zinc-900/30 space-y-3 animate-pulse text-left">
          <div className="h-4 w-32 bg-zinc-800 rounded" />
          <div className="h-7 w-48 bg-zinc-800/70 rounded" />
          <div className="h-3 w-40 bg-zinc-800/40 rounded" />
        </div>
        <div className="p-4 rounded-xl border border-zinc-800/80 bg-zinc-900/30 space-y-3 animate-pulse text-left">
          <div className="h-4 w-36 bg-zinc-800 rounded" />
          <div className="h-7 w-44 bg-zinc-800/70 rounded" />
          <div className="h-3 w-36 bg-zinc-800/40 rounded" />
        </div>
      </div>
    </div>
  );
}

export function WhaleRadarPanel() {
  const { locale } = useTranslation();
  const id = locale === "id";
  const [activeTab, setActiveTab] = useState<RadarTab>("insider");
  const { data, isLoading, isError, error, refetch, isFetching } = useWhaleRadarQuery(activeTab !== "insider");

  const tabItems: { id: RadarTab; label: string; icon: typeof Landmark }[] = [
    { id: "etf", label: id ? "BlackRock & ETF" : "BlackRock & ETFs", icon: Landmark },
    { id: "insider", label: id ? "Filing Insider SEC" : "SEC Insider Filings", icon: FileText },
    { id: "whales", label: id ? "Dompet Paus" : "Whale Wallets", icon: Wallet },
    { id: "commodities", label: id ? "Minyak & Logam" : "Oil & Metals", icon: Coins },
    { id: "social", label: id ? "Berita Publik" : "Public News", icon: MessageSquareQuote },
  ];

  return (
    <section className="desk-panel space-y-6">
      {/* Header Bar */}
      <div className="desk-panel-head flex-wrap gap-4 pb-4 border-b border-zinc-800/80">
        <div>
          <div className="flex items-center gap-2">
            <span className="desk-eyebrow text-amber-400 font-mono tracking-wider">
              {id ? "INTELIJEN ON-CHAIN & INSTITUSI" : "ON-CHAIN & INSTITUTIONAL INTEL"}
            </span>
            {data?.btcPrice != null && activeTab !== "insider" && (
              <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700">
                BTC Ref: {formatUsd(data.btcPrice)}
              </span>
            )}
          </div>
          <h2 className="text-xl md:text-2xl font-bold tracking-tight text-zinc-100 flex items-center gap-2 mt-1">
            <span>{id ? "Radar Insider, Institusi & Paus" : "Insider, Institutional & Whale Radar"}</span>
            <Sparkles size={18} className="text-amber-400" />
          </h2>
        </div>

        <div className="flex items-center gap-3">
          {data?.fetchedAt && activeTab !== "insider" && (
            <span className="text-[11px] text-zinc-500 font-mono hidden sm:inline-block">
              {id ? "Diperbarui" : "Updated"}: {new Date(data.fetchedAt).toLocaleTimeString()}
            </span>
          )}
          <button
            type="button"
            disabled={isFetching || activeTab === "insider"}
            onClick={() => void refetch()}
            className="desk-button flex items-center gap-1.5 text-xs font-semibold py-1.5 px-3 rounded-lg border border-zinc-700 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 transition-colors disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw size={14} className={isFetching ? "animate-spin" : ""} />
            <span>{id ? "Segarkan" : "Refresh"}</span>
          </button>
        </div>
      </div>

      {/* Tab Switcher with smooth sliding motion pill */}
      <div className="flex flex-wrap items-center gap-2 p-1.5 rounded-xl bg-zinc-950/80 border border-zinc-800/80 max-w-4xl">
        {tabItems.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`relative flex-1 min-w-[125px] flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition-colors cursor-pointer select-none ${
                isActive ? "text-zinc-950 font-extrabold" : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60"
              }`}
            >
              {isActive && (
                <motion.span
                  layoutId="activeRadarTabPill"
                  className="absolute inset-0 bg-amber-500 rounded-lg shadow-md -z-0"
                  transition={{ type: "spring", stiffness: 450, damping: 35 }}
                />
              )}
              <span className="relative z-10 flex items-center gap-2">
                <Icon size={15} />
                <span>{tab.label}</span>
              </span>
            </button>
          );
        })}
      </div>

      {/* Main Content Area with fluid AnimatePresence transition */}
      <AnimatePresence mode="wait">
        {activeTab === "insider" ? (
          <motion.div
            key="insider"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
          >
            <InsiderFilingsView />
          </motion.div>
        ) : isLoading ? (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            <RadarScannerLoader id={id} />
          </motion.div>
        ) : isError ? (
          <motion.div
            key="error"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.18 }}
            className="p-8 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 space-y-3"
          >
            <div className="flex items-center gap-2 font-bold text-sm">
              <AlertCircle size={18} />
              <span>{id ? "Gagal memuat data radar" : "Failed to load radar data"}</span>
            </div>
            <p className="text-xs text-rose-400/80">
              {error?.message || (id ? "Terjadi kesalahan saat mengambil data." : "An unexpected error occurred.")}
            </p>
            <button
              type="button"
              onClick={() => void refetch()}
              className="px-3 py-1.5 text-xs font-bold rounded-lg bg-rose-500 text-zinc-950 hover:bg-rose-400 transition-colors"
            >
              {id ? "Coba Lagi" : "Try Again"}
            </button>
          </motion.div>
        ) : data ? (
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
          >
            {activeTab === "etf" && <BlackRockEtfView data={data} />}
            {activeTab === "whales" && <WhaleWalletsView data={data} />}
            {activeTab === "commodities" && <CommoditiesRadarView data={data} />}
            {activeTab === "social" && <XVipSocialView data={data} />}
          </motion.div>
        ) : null}
      </AnimatePresence>

      {activeTab !== "insider" && data && (
        <details className="text-sm rounded-lg border border-zinc-800/80 bg-zinc-950/40 p-3">
          <summary className="cursor-pointer font-medium text-zinc-300 hover:text-zinc-100">
            {id ? "Status & sumber data" : "Data sources & status"}
          </summary>
          <div className="mt-3 space-y-2">
            {data.sources.map((source) => <SourceStatus key={source.url} source={source} />)}
          </div>
        </details>
      )}

      {/* Informational Disclaimer Footer */}
      <div className="pt-4 border-t border-zinc-800/80 text-[11px] text-zinc-500 leading-relaxed space-y-1">
        <p>
          {id
            ? "Catatan: Form 4 adalah pengungkapan transaksi, bukan bukti pelanggaran insider trading. Anomali pasar dan perpindahan dompet tidak mengidentifikasi insider."
            : "Note: Form 4 discloses transactions; it does not establish illegal insider trading. Market anomalies and wallet transfers do not identify insiders."}
        </p>
      </div>
    </section>
  );
}
