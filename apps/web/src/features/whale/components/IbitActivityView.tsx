"use client";
import { useState } from "react";
import type { EtfActivity, EtfActivityRow } from "@/lib/server/etfActivity";
import { formatBtc, formatUsd } from "../utils/formatters";
import { SourceStatus } from "./SourceStatus";

function exportRows(rows: EtfActivityRow[]) {
  const header = ["Disclosure date", "BTC holdings", "Previous disclosure date", "Net holdings change BTC", "Reported IBIT net flow USD (Farside)", "Estimated holdings change USD (XOOMAR)", "Holdings source"];
  const csv = [header, ...rows.map((r) => [r.date, r.btcHeld, r.previousHoldingsDate, r.holdingsChangeBtc, r.netFlowUsd, r.estimatedHoldingsChangeUsd, r.holdingsSourceUrl])]
    .map((row) => row.map((value) => `"${String(value ?? "").replaceAll('"', '""')}"`).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a"); anchor.href = url; anchor.download = "ibit-activity.csv";
  anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const signedBtc = (value: number | null) => value === null ? "—" : `${value > 0 ? "+" : ""}${formatBtc(value)}`;
const signedUsd = (value: number | null) => value === null ? "—" : `${value > 0 ? "+" : ""}${formatUsd(value, true)}`;

export function IbitActivityView({ activity, id }: { activity: EtfActivity; id: boolean }) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [limit, setLimit] = useState(30);
  const invalidRange = Boolean(from && to && from > to);
  const rows = invalidRange ? [] : activity.rows.filter((r) => (!from || r.date >= from) && (!to || r.date <= to));
  const latest = activity.rows.find((r) => r.holdingsChangeBtc !== null);
  return <section className="space-y-3 rounded-xl border border-zinc-700 bg-zinc-900/40 p-4">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h3 className="font-bold text-zinc-100">{id ? "Aktivitas BlackRock · IBIT per tanggal" : "BlackRock · IBIT activity by date"}</h3>
      <button type="button" disabled={!rows.length} onClick={() => exportRows(rows)} className="desk-button text-xs disabled:opacity-40">{id ? "Ekspor CSV" : "Export CSV"}</button>
    </div>
    <p className="text-xs text-zinc-300">{id
      ? "Perubahan bersih BTC dihitung antar tanggal laporan yang tersedia. Estimasi USD XOOMAR berasal dari perubahan holdings; berbeda dari net flow ETF Farside. Keduanya bukan catatan eksekusi pembelian BlackRock."
      : "Net BTC change compares available disclosure dates. XOOMAR estimates USD from holdings changes; Farside reports ETF net flow separately. Neither is a BlackRock purchase execution record."}</p>
    {latest && <p className="text-sm text-zinc-100 font-mono">{latest.date}: {signedBtc(latest.holdingsChangeBtc)} <span className="text-xs text-zinc-400">{id ? "dibanding laporan" : "versus disclosure"} {latest.previousHoldingsDate}</span></p>}
    <div className="flex flex-wrap items-end gap-3 text-xs text-zinc-300">
      <label className="space-y-1">{id ? "Dari tanggal laporan" : "From disclosure date"}<input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setLimit(30); }} className="block rounded border border-zinc-600 bg-zinc-950 p-2 text-zinc-100 [color-scheme:dark]" /></label>
      <label className="space-y-1">{id ? "Sampai tanggal laporan" : "To disclosure date"}<input type="date" value={to} onChange={(e) => { setTo(e.target.value); setLimit(30); }} className="block rounded border border-zinc-600 bg-zinc-950 p-2 text-zinc-100 [color-scheme:dark]" /></label>
      <button type="button" className="desk-button" onClick={() => { setFrom(""); setTo(""); setLimit(30); }}>{id ? "Semua tanggal" : "All dates"}</button>
      <span>{rows.length} {id ? "laporan" : "disclosures"}</span>
    </div>
    {invalidRange && <p role="alert" className="text-xs text-amber-300">{id ? "Tanggal awal harus sebelum atau sama dengan tanggal akhir." : "Start date must be on or before end date."}</p>}
    <div className="overflow-x-auto">
      <table className="w-full text-xs text-left whitespace-nowrap">
        <caption className="sr-only">{id ? "Riwayat holdings dan arus dana IBIT" : "IBIT holdings and fund flow history"}</caption>
        <thead className="text-zinc-400"><tr>{[id ? "Tanggal laporan" : "Disclosure", "BTC", id ? "Perubahan BTC" : "BTC change", id ? "Dibanding tanggal" : "Compared with", id ? "Net flow USD · Farside" : "Net flow USD · Farside", id ? "Estimasi USD · XOOMAR" : "Estimated USD · XOOMAR"].map((h) => <th scope="col" key={h} className="py-2 pr-4 font-medium">{h}</th>)}</tr></thead>
        <tbody>{rows.slice(0, limit).map((r) => <tr key={r.date} className="border-t border-zinc-800 text-zinc-200 font-mono">
          <th scope="row" className="py-2 pr-4 font-normal">{r.holdingsSourceUrl ? <a href={r.holdingsSourceUrl} target="_blank" rel="noopener noreferrer" className="underline">{r.date}</a> : r.date}</th>
          <td className="pr-4">{formatBtc(r.btcHeld)}</td>
          <td className={`pr-4 ${r.holdingsChangeBtc === null ? "text-zinc-500" : r.holdingsChangeBtc > 0 ? "text-emerald-300" : r.holdingsChangeBtc < 0 ? "text-rose-300" : ""}`}>{signedBtc(r.holdingsChangeBtc)}</td>
          <td className="pr-4 text-zinc-400">{r.previousHoldingsDate ?? "—"}</td>
          <td className="pr-4">{signedUsd(r.netFlowUsd)}</td><td>{signedUsd(r.estimatedHoldingsChangeUsd)}</td>
        </tr>)}</tbody>
      </table>
    </div>
    {!rows.length && <p className="text-sm text-zinc-400">{id ? "Belum ada laporan untuk tanggal ini. Tanggal kosong tidak berarti transaksi nol." : "No disclosure available for these dates. Missing data does not mean zero activity."}</p>}
    {rows.length > limit && <button type="button" className="desk-button text-xs" onClick={() => setLimit((n) => n + 30)}>{id ? "Tampilkan 30 berikutnya" : "Show next 30"}</button>}
    <p className="text-xs text-zinc-400">{id ? "— berarti data tidak tersedia. Hari libur dan tanggal laporan yang terlewat tidak diisi perkiraan." : "— means unavailable. Holidays and missing disclosure dates are not filled with estimates."}</p>
    <p className="text-xs text-zinc-400">Data: <a href="https://xoomar.com/markets/api/etf-flows" target="_blank" rel="noopener noreferrer" className="underline">XOOMAR</a> · ETF holdings data: iShares, Bitwise and ARK 21Shares. <a href="https://farside.co.uk/btc/" target="_blank" rel="noopener noreferrer" className="underline">Farside ETF flows</a></p>
    {activity.sources.map((s) => <SourceStatus key={s.url} source={s} />)}
    {activity.persistenceError && <p role="alert" className="text-xs text-amber-300">{id ? "Arsip lokal gagal disimpan/dibaca" : "Local archive read/write failed"}: {activity.persistenceError}</p>}
    <div className="border-t border-zinc-700 pt-3 text-xs text-zinc-300 space-y-1">
      <h4 className="font-semibold">{id ? "Transfer wallet BlackRock" : "BlackRock wallet transfers"} · unavailable</h4>
      <p>{id ? "Belum ada feed publik otomatis dengan atribusi alamat BlackRock yang bisa diverifikasi di server ini. Transfer tidak dihitung sebagai pembelian." : "No automatic public feed with verifiable BlackRock address attribution is available to this server. Transfers are not counted as purchases."}</p>
      <a href="https://platform.arkhamintelligence.com/explorer/entity/blackrock" target="_blank" rel="noopener noreferrer" className="inline-block underline text-amber-300">{id ? "Lihat label wallet dan transaksi di Arkham" : "Inspect wallet labels and transfers on Arkham"}</a>
    </div>
  </section>;
}
