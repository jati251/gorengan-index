"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Copy } from "lucide-react";
import type { WhaleRadarData } from "../types";
import { formatBtc, formatUsd, formatPercent } from "../utils/formatters";
import { useTranslation } from "@/features/i18n";
import { SourceStatus } from "./SourceStatus";

export function WhaleWalletsView({ data }: { data: WhaleRadarData }) {
  const id = useTranslation().locale === "id";
  const [minimum, setMinimum] = useState(5);
  const [copyStatus, setCopyStatus] = useState("");
  const transactions = data.recentLargeTxs.filter((tx) => tx.amountBtc >= minimum);

  async function copy(address: string) {
    try {
      await navigator.clipboard.writeText(address);
      setCopyStatus(id ? "Alamat berhasil disalin!" : "Address copied to clipboard!");
      setTimeout(() => setCopyStatus(""), 2500);
    } catch {
      setCopyStatus(id ? "Gagal menyalin; pilih alamat secara manual." : "Copy failed; select address manually.");
      setTimeout(() => setCopyStatus(""), 2500);
    }
  }

  return (
    <div className="space-y-5">
      <p className="text-sm text-zinc-300">
        {id
          ? "Total output transaksi termasuk kembalian ke pengirim. Transfer bukan bukti penjualan. Sampel mempool ini tidak mencakup seluruh aktivitas Bitcoin; identitas pemilik tidak disimpulkan dari awalan alamat."
          : "Transaction outputs include change returned to the sender. Transfers do not prove sales. This mempool sample is not complete Bitcoin activity; address prefixes do not establish ownership."}
      </p>

      {/* Top Stats Cards with Motion */}
      <div className="grid gap-3 sm:grid-cols-2">
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="p-4 border border-zinc-700/80 rounded-xl bg-zinc-900/40 space-y-1 shadow-sm"
        >
          <p className="text-xs text-zinc-400 font-mono">{id ? "Saldo alamat yang berhasil dimuat" : "Balances of successfully loaded addresses"}</p>
          <strong className="text-xl sm:text-2xl font-mono font-bold text-amber-400 block">{formatBtc(data.stats.topWhalesHoldingsBtc)}</strong>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05, duration: 0.2 }}
          className="p-4 border border-zinc-700/80 rounded-xl bg-zinc-900/40 space-y-1 shadow-sm"
        >
          <p className="text-xs text-zinc-400 font-mono">{id ? "Bagian dari suplai ditambang" : "Share of mined supply"}</p>
          <strong className="text-xl sm:text-2xl font-mono font-bold text-cyan-400 block">{formatPercent(data.stats.topWhalesSupplySharePercent, false)}</strong>
          <p className="text-xs text-zinc-400 font-mono">{formatBtc(data.stats.circulatingSupplyBtc, 0)}</p>
        </motion.div>
      </div>

      <div className="flex items-center justify-between">
        <h3 className="font-bold text-base text-zinc-100">{id ? "Alamat pantauan" : "Watched addresses"}</h3>
        <AnimatePresence>
          {copyStatus && (
            <motion.span
              initial={{ opacity: 0, scale: 0.9, y: -4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: -4 }}
              transition={{ duration: 0.15 }}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-mono text-xs font-semibold"
            >
              <Check size={13} />
              <span>{copyStatus}</span>
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      {!data.whaleEntities.length && <p role="status" className="text-xs text-zinc-400">{id ? "Saldo alamat belum tersedia." : "Address balances unavailable."}</p>}
      <div className="space-y-3">
        {data.whaleEntities.map((w, idx) => (
          <motion.article
            key={w.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.04, duration: 0.2 }}
            className="p-4 border border-zinc-700/80 rounded-xl bg-zinc-900/40 space-y-2 hover:border-zinc-600 transition-colors"
          >
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <a href={w.explorerUrl} target="_blank" rel="noopener noreferrer" className="underline font-mono break-all text-xs sm:text-sm text-amber-300 hover:text-amber-200">
                {w.address}
              </a>
              <button
                type="button"
                className="desk-button shrink-0 flex items-center gap-1.5 text-xs py-1 px-2.5"
                onClick={() => void copy(w.address)}
              >
                <Copy size={12} />
                <span>{id ? "Salin" : "Copy"}</span>
              </button>
            </div>
            <p className="font-mono text-sm text-zinc-100 font-semibold">
              {formatBtc(w.balanceBtc)} · <span className="text-zinc-400 font-normal">{formatUsd(w.balanceUsd, true)}</span>
            </p>
            <p className="text-xs text-zinc-400">{id ? "Atribusi pemilik belum diverifikasi." : w.labelNote}</p>
            <SourceStatus source={w.source} />
          </motion.article>
        ))}
      </div>

      <label className="text-sm flex gap-3 items-center flex-wrap pt-2">
        <span className="font-medium text-zinc-300">{id ? "Minimum total output (BTC)" : "Minimum output total (BTC)"}</span>
        <input
          type="number"
          min="5"
          step="1"
          value={minimum}
          onChange={(e) => setMinimum(Math.max(5, Number(e.target.value) || 5))}
          className="w-28 bg-zinc-900 border border-zinc-700 rounded-lg p-2 font-mono text-zinc-100 text-sm"
        />
      </label>
      <p className="text-xs text-zinc-400">
        {transactions.length} {id ? "transaksi cocok; maks. 30 terbesar dari sampel, batas pengambilan 5 BTC." : "matching transactions; at most 30 largest from the sample, retrieval threshold 5 BTC."}
      </p>

      {!transactions.length && <p role="status" className="text-xs text-zinc-400">{id ? "Tidak ada transaksi tersedia di atas ambang ini." : "No available transactions above this threshold."}</p>}
      <div className="space-y-2">
        {transactions.map((tx, idx) => (
          <motion.article
            key={tx.txid}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(idx * 0.03, 0.3), duration: 0.18 }}
            className="p-3 border border-zinc-700/80 rounded-xl bg-zinc-900/40 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4 hover:border-zinc-600 transition-colors"
          >
            <div className="min-w-0">
              <a href={tx.explorerUrl} target="_blank" rel="noopener noreferrer" className="font-mono underline text-amber-300 hover:text-amber-200 text-xs sm:text-sm break-all">
                {tx.txidShort}
              </a>
              <p className="text-xs text-zinc-400 mt-0.5">
                {new Date(tx.timestamp).toLocaleTimeString()} · {tx.status} · {tx.senderLabel} → {tx.receiverLabel}
              </p>
            </div>
            <div className="text-left sm:text-right shrink-0 font-mono">
              <span className="font-bold text-zinc-100">{formatBtc(tx.amountBtc, 4)}</span>
              <p className="text-xs text-zinc-400">{formatUsd(tx.amountUsd, true)}</p>
            </div>
          </motion.article>
        ))}
      </div>
    </div>
  );
}
