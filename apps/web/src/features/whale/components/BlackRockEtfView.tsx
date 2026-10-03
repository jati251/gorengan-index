"use client";
import { motion } from "framer-motion";
import type { WhaleRadarData } from "../types";
import { formatUsd, formatPercent, formatBtc } from "../utils/formatters";
import { useTranslation } from "@/features/i18n";
import { IbitActivityView } from "./IbitActivityView";
import { SourceStatus } from "./SourceStatus";

export function BlackRockEtfView({ data }: { data: WhaleRadarData }) {
  const id = useTranslation().locale === "id";
  return (
    <div className="space-y-4">
      <p className="text-sm text-zinc-300">
        {id
          ? "Harga ETF adalah kuotasi tertunda atau penutupan terakhir. Volume saham bukan arus dana bersih ETF. Cadangan IBIT dibaca dari CSV resmi BlackRock; riwayat aktivitas tersedia di bawah."
          : "ETF prices are delayed quotes or the last close. Share volume is not ETF net flow. IBIT reserves come from the official BlackRock CSV; dated activity is shown below."}
      </p>

      {/* Featured IBIT Holdings Card */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="p-4 border border-zinc-700/80 rounded-xl bg-zinc-900/50 space-y-1 shadow-sm"
      >
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h3 className="font-bold text-zinc-100 font-mono">IBIT · {id ? "Kepemilikan dilaporkan penerbit" : "Issuer-reported holdings"}</h3>
          <span className="text-xs text-zinc-400 font-mono">{id ? "Tanggal laporan" : "Disclosure date"}: {data.etfSummary.holdingsAsOf ?? "—"}</span>
        </div>
        <div className="text-2xl font-mono font-bold text-amber-400">
          {formatBtc(data.etfSummary.ibit.btcHeld)}{" "}
          <span className="text-sm font-normal text-zinc-300">({formatUsd(data.etfSummary.ibit.aumUsd, true)})</span>
        </div>
        <p className="text-xs text-zinc-400">{id ? "Nilai pasar kepemilikan BTC, bukan total AUM semua ETF." : "BTC holdings market value, not all-ETF AUM."}</p>
      </motion.div>

      <IbitActivityView activity={data.etfSummary.activity} id={id} />

      {/* Grid of all ETFs */}
      <div className="grid gap-3 sm:grid-cols-2">
        {data.etfSummary.allEtfs.map((etf, idx) => (
          <motion.article
            key={etf.symbol}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.04, duration: 0.2 }}
            className="p-4 rounded-xl border border-zinc-700/80 bg-zinc-900/40 space-y-2 hover:border-zinc-600 transition-colors"
          >
            <h3 className="font-bold text-zinc-100">{etf.symbol} · {etf.name}</h3>
            <p className="text-xs text-zinc-400">{etf.issuer}</p>
            <div className="text-xl font-mono text-zinc-100">
              {formatUsd(etf.price)}{" "}
              <span className="text-sm">{formatPercent(etf.changePercent24h)}</span>
            </div>
            <p className="text-xs text-zinc-300">
              {id ? "Volume sesi (saham)" : "Session volume (shares)"}: {etf.volume24h?.toLocaleString() ?? "—"}
            </p>
            <SourceStatus source={etf.source} asOf={etf.asOf} />
          </motion.article>
        ))}
      </div>
      <a href="https://www.ishares.com/us/products/333011/ishares-bitcoin-trust-etf" target="_blank" rel="noopener noreferrer" className="text-sm underline text-amber-300">
        {id ? "Laporan resmi IBIT / BlackRock" : "Official IBIT / BlackRock disclosures"}
      </a>
    </div>
  );
}
