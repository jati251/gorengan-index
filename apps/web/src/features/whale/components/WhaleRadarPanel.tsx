"use client";

import { useState } from "react";
import { Landmark, Wallet, RefreshCw, AlertCircle, Sparkles, Coins, MessageSquareQuote } from "lucide-react";
import { useWhaleRadarQuery } from "../api/useWhaleRadarQuery";
import { BlackRockEtfView } from "./BlackRockEtfView";
import { WhaleWalletsView } from "./WhaleWalletsView";
import { CommoditiesRadarView } from "./CommoditiesRadarView";
import { XVipSocialView } from "./XVipSocialView";
import { useTranslation } from "@/features/i18n";
import { formatUsd } from "../utils/formatters";

type RadarTab = "etf" | "whales" | "commodities" | "social";

export function WhaleRadarPanel() {
  const { locale } = useTranslation();
  const id = locale === "id";
  const [activeTab, setActiveTab] = useState<RadarTab>("etf");
  const { data, isLoading, isError, error, refetch, isFetching } = useWhaleRadarQuery();

  return (
    <section className="desk-panel space-y-6">
      {/* Header Bar */}
      <div className="desk-panel-head flex-wrap gap-4 pb-4 border-b border-zinc-800/80">
        <div>
          <div className="flex items-center gap-2">
            <span className="desk-eyebrow text-amber-400 font-mono tracking-wider">
              {id ? "INTELIJEN ON-CHAIN & INSTITUSI" : "ON-CHAIN & INSTITUTIONAL INTEL"}
            </span>
            {data?.btcPrice && (
              <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700">
                BTC Ref: {formatUsd(data.btcPrice)}
              </span>
            )}
          </div>
          <h2 className="text-xl md:text-2xl font-bold tracking-tight text-zinc-100 flex items-center gap-2 mt-1">
            <span>{id ? "Radar Institusi, Paus & VIP Alpha" : "Institutional, Whale & VIP Radar"}</span>
            <Sparkles size={18} className="text-amber-400" />
          </h2>
        </div>

        <div className="flex items-center gap-3">
          {data?.fetchedAt && (
            <span className="text-[11px] text-zinc-500 font-mono hidden sm:inline-block">
              {id ? "Diperbarui" : "Updated"}: {new Date(data.fetchedAt).toLocaleTimeString()}
            </span>
          )}
          <button
            type="button"
            disabled={isFetching}
            onClick={() => void refetch()}
            className="desk-button flex items-center gap-1.5 text-xs font-semibold py-1.5 px-3 rounded-lg border border-zinc-700 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 transition-colors disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw size={14} className={isFetching ? "animate-spin" : ""} />
            <span>{id ? "Segarkan" : "Refresh"}</span>
          </button>
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="flex flex-wrap items-center gap-2 p-1.5 rounded-xl bg-zinc-950/80 border border-zinc-800/80 max-w-3xl">
        <button
          type="button"
          onClick={() => setActiveTab("etf")}
          className={`flex-1 min-w-[130px] flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            activeTab === "etf"
              ? "bg-amber-500 text-zinc-950 shadow-md font-extrabold"
              : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
          }`}
        >
          <Landmark size={15} />
          <span>{id ? "BlackRock & ETF" : "BlackRock & ETFs"}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("whales")}
          className={`flex-1 min-w-[130px] flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            activeTab === "whales"
              ? "bg-amber-500 text-zinc-950 shadow-md font-extrabold"
              : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
          }`}
        >
          <Wallet size={15} />
          <span>{id ? "Dompet Paus" : "Whale Wallets"}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("commodities")}
          className={`flex-1 min-w-[130px] flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            activeTab === "commodities"
              ? "bg-amber-500 text-zinc-950 shadow-md font-extrabold"
              : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
          }`}
        >
          <Coins size={15} />
          <span>{id ? "Minyak & Logam" : "Oil & Metals"}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("social")}
          className={`flex-1 min-w-[150px] flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            activeTab === "social"
              ? "bg-amber-500 text-zinc-950 shadow-md font-extrabold"
              : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
          }`}
        >
          <MessageSquareQuote size={15} />
          <span>{id ? "X-Alpha: Konglo & Paus" : "X-Alpha: VIP & Whales"}</span>
        </button>
      </div>

      {/* Main Content Area */}
      {isLoading ? (
        <div className="p-12 flex flex-col items-center justify-center text-center space-y-3">
          <RefreshCw size={28} className="animate-spin text-amber-400" />
          <div className="text-sm font-bold text-zinc-300">
            {id ? "Menghubungkan ke data on-chain, ETF, komoditas & VIP feed..." : "Loading on-chain, ETF, commodity & VIP social intelligence..."}
          </div>
          <p className="text-xs text-zinc-500 max-w-md">
            {id
              ? "Mengambil data cadangan brankas institusi, harga emas, perak, minyak mentah, serta radar cuitan konglomerat & paus pasar."
              : "Fetching institutional cold reserves, live gold, silver, crude oil quotes, and VIP tycoon social signals."}
          </p>
        </div>
      ) : isError ? (
        <div className="p-8 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 space-y-3">
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
        </div>
      ) : data ? (
        activeTab === "etf" ? (
          <BlackRockEtfView data={data} />
        ) : activeTab === "whales" ? (
          <WhaleWalletsView data={data} />
        ) : activeTab === "commodities" ? (
          <CommoditiesRadarView data={data} />
        ) : (
          <XVipSocialView data={data} />
        )
      ) : null}

      {/* Informational Disclaimer Footer */}
      <div className="pt-4 border-t border-zinc-800/80 text-[11px] text-zinc-500 leading-relaxed space-y-1">
        <p>
          {id
            ? "Catatan: Data cadangan ETF BlackRock (IBIT) bersumber dari laporan kepemilikan kustodian fisik Coinbase Prime & SEC filing. Alamat dompet paus dipantau langsung dari public mempool Bitcoin. Bukan saran finansial."
            : "Note: BlackRock (IBIT) ETF reserves are sourced from physical custody disclosures & SEC filings. Whale wallet addresses are tracked via the public Bitcoin mempool. Not financial advice."}
        </p>
      </div>
    </section>
  );
}
