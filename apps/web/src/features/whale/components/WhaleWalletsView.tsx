"use client";
import { useState } from "react";
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
    try { await navigator.clipboard.writeText(address); setCopyStatus(id ? "Alamat disalin" : "Address copied"); }
    catch { setCopyStatus(id ? "Gagal menyalin; pilih alamat secara manual." : "Copy failed; select the address manually."); }
  }
  return <div className="space-y-5">
    <p className="text-sm text-zinc-300">{id ? "Total output transaksi termasuk kembalian ke pengirim. Transfer bukan bukti penjualan. Sampel mempool ini tidak mencakup seluruh aktivitas Bitcoin; identitas pemilik tidak disimpulkan dari awalan alamat." : "Transaction outputs include change returned to the sender. Transfers do not prove sales. This mempool sample is not complete Bitcoin activity; address prefixes do not establish ownership."}</p>
    <div className="grid gap-3 sm:grid-cols-2"><div className="p-4 border border-zinc-700 rounded"><p className="text-xs text-zinc-400">{id ? "Saldo alamat yang berhasil dimuat" : "Balances of successfully loaded addresses"}</p><strong>{formatBtc(data.stats.topWhalesHoldingsBtc)}</strong></div><div className="p-4 border border-zinc-700 rounded"><p className="text-xs text-zinc-400">{id ? "Bagian dari suplai ditambang" : "Share of mined supply"}</p><strong>{formatPercent(data.stats.topWhalesSupplySharePercent, false)}</strong><p className="text-xs">{formatBtc(data.stats.circulatingSupplyBtc, 0)}</p></div></div>
    <h3 className="font-bold">{id ? "Alamat pantauan" : "Watched addresses"}</h3>
    {!data.whaleEntities.length && <p role="status">{id ? "Saldo alamat belum tersedia." : "Address balances unavailable."}</p>}
    {data.whaleEntities.map((w) => <article className="p-4 border border-zinc-700 rounded space-y-2" key={w.id}>
      <div className="flex items-center gap-3 flex-wrap"><a href={w.explorerUrl} target="_blank" rel="noopener noreferrer" className="underline font-mono break-all">{w.address}</a><button type="button" className="desk-button" onClick={() => void copy(w.address)}>{id ? "Salin" : "Copy"}</button></div>
      <p>{formatBtc(w.balanceBtc)} · {formatUsd(w.balanceUsd, true)}</p><p className="text-xs text-zinc-400">{id ? "Atribusi pemilik belum diverifikasi." : w.labelNote}</p><SourceStatus source={w.source} />
    </article>)}<p role="status" className="text-xs">{copyStatus}</p>
    <label className="text-sm flex gap-3 items-center">{id ? "Minimum total output (BTC)" : "Minimum output total (BTC)"}<input type="number" min="5" step="1" value={minimum} onChange={(e) => setMinimum(Math.max(5, Number(e.target.value) || 5))} className="w-28 bg-zinc-900 border border-zinc-700 rounded p-2" /></label>
    <p className="text-xs text-zinc-400">{transactions.length} {id ? "transaksi cocok; maks. 30 terbesar dari sampel, batas pengambilan 5 BTC." : "matching transactions; at most 30 largest from the sample, retrieval threshold 5 BTC."}</p>
    {!transactions.length && <p role="status">{id ? "Tidak ada transaksi tersedia di atas ambang ini." : "No available transactions above this threshold."}</p>}
    {transactions.map((tx) => <article key={tx.txid} className="p-3 border border-zinc-700 rounded flex flex-wrap justify-between gap-3">
      <div><a href={tx.explorerUrl} target="_blank" rel="noopener noreferrer" className="font-mono underline">{tx.txidShort}</a><p className="text-xs text-zinc-400">{new Date(tx.timestamp).toLocaleString()} · {tx.status} · {tx.senderLabel} → {tx.receiverLabel}</p></div><div>{formatBtc(tx.amountBtc, 4)}<p className="text-xs text-zinc-400">{formatUsd(tx.amountUsd, true)}</p></div>
    </article>)}
  </div>;
}
