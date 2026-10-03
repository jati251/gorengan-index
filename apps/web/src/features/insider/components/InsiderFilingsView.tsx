"use client";
import { useEffect, useState } from "react";
import { useFilingWatchStore } from "../stores/filingWatchStore";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "@/features/i18n";
import { SourceStatus } from "@/features/whale/components/SourceStatus";
import { OwnershipContext } from "./OwnershipContext";
import { filingContext, importFilingXml } from "../utils/context";
import { type InsiderFiling, type FilingsResult, type parseOwnershipXml } from "../utils/filings";
import type { PublicResult } from "@/lib/server/publicData";

async function read<T>(url: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal: AbortSignal.any([signal, AbortSignal.timeout(15000)]) });
  if (!response.ok) throw new Error(`Request failed (${response.status})`);
  return response.json();
}
function FilingDetails({ filing }: { filing: InsiderFiling }) {
  const id = useTranslation().locale === "id";
  const [imported, setImported] = useState<{ name: string; detail: ReturnType<typeof parseOwnershipXml> } | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const query = new URLSearchParams({ cik: filing.cik, accession: filing.accession, document: filing.document });
  const { data, isPending, error } = useQuery({ queryKey: ["insider-filing", filing.accession], queryFn: ({ signal }) => read<PublicResult<ReturnType<typeof parseOwnershipXml>>>(`/api/insider-filings/detail?${query}`, signal), staleTime: 86400000, retry: false });
  if (isPending) return <p role="status">{id ? "Mengambil XML transaksi…" : "Loading transaction XML…"}</p>;
  const detail = imported?.detail ?? data?.data;
  async function importXml(file: File | undefined) {
    if (!file) return;
    setImportError(null);
    setImported(null);
    try {
      if (file.size > 2_000_000) throw new Error(id ? "XML maksimal 2 MB." : "XML must be at most 2 MB.");
      const parsed = importFilingXml(await file.text(), filing);
      setImported({ name: file.name, detail: parsed });
    } catch (cause) { setImportError(cause instanceof Error ? cause.message : "Invalid XML"); }
  }
  return <div className="space-y-3 mt-3 text-sm">
    {error && <p role="alert">{error.message}</p>}
    {data && <SourceStatus source={data} />}
    {!data?.data && <label className="block text-xs space-y-2">
      <span>{id ? "Analisis XML SEC yang sudah kamu unduh (diproses lokal)" : "Analyze a SEC XML file you downloaded (processed locally)"}</span>
      <input type="file" accept=".xml,text/xml,application/xml" onChange={(event) => void importXml(event.target.files?.[0])} className="block w-full" />
      <span className="block text-zinc-400">{id ? "CIK emiten, periode, dan jenis amendemen diperiksa. Cocokkan accession dengan tautan dokumen asli sebelum memakai hasilnya." : "Issuer CIK, report period and amendment type are checked. Match the accession against the original document link before using the result."}</span>
    </label>}
    {importError && <p role="alert">{importError}</p>}
    {imported && <p role="status">{id ? "XML lokal" : "Local XML"}: {imported.name}</p>}
    {detail && <><h4 className="font-bold">{detail.ticker} · {detail.issuer}</h4><p>{detail.owners.map((o) => `${o.name} (${o.role || (o.director ? "Director" : "Reporting owner")})`).join("; ")}</p>
      <p>{detail.amended ? "Amendment · " : ""}10b5-1 checkbox: {detail.planned10b51 === null ? (id ? "Tidak tersedia pada XML" : "Not available in XML") : detail.planned10b51 ? "Yes" : "Not checked"}</p>
      <OwnershipContext detail={detail} />
      <p className="text-xs text-zinc-400">{id ? "P/S: pembelian/penjualan terbuka atau privat; A: award; M: exercise; F: pemotongan pajak; G: hibah. Baris derivatif dipisahkan. Laporan bersama, amendemen, dan footnote perlu ditinjau sebelum menjumlahkan transaksi." : "P/S: open-market or private purchase/sale; A: award; M: exercise; F: tax withholding; G: gift. Derivative rows are marked. Review joint owners, amendments and footnotes before aggregating."}</p>
      {detail.footnotes.map((note, i) => <p key={i} className="text-xs text-zinc-400">{note}</p>)}
    </>}
  </div>;
}
export function InsiderFilingsView() {
  const id = useTranslation().locale === "id";
  const [input, setInput] = useState("");
  const [search, setSearch] = useState("");
  const [days, setDays] = useState(30);
  const [offset, setOffset] = useState(0);
  const baselines = useFilingWatchStore((state) => state.baselines);
  const markSeen = useFilingWatchStore((state) => state.markSeen);
  const stopWatch = useFilingWatchStore((state) => state.stop);
  useEffect(() => { void useFilingWatchStore.persist.rehydrate(); }, []);
  const watchKey = `${days}:${search}`;
  const baseline = baselines[watchKey];
  const [expanded, setExpanded] = useState<string | null>(null);
  const query = new URLSearchParams({ q: search, days: String(days), offset: String(offset) });
  const { data, isPending, isFetching, error, refetch } = useQuery({ queryKey: ["insider-filings", search, days, offset], queryFn: ({ signal }) => read<FilingsResult>(`/api/insider-filings?${query}`, signal), staleTime: 300000, refetchInterval: 300000, retry: 1 });
  return <div className="space-y-4">
    <h3 className="font-bold text-lg">{id ? "Pengungkapan Transaksi Insider · SEC Form 4" : "Disclosed Insider Transactions · SEC Form 4"}</h3>
    <p className="text-sm text-zinc-300">{id ? "Filing resmi AS diperbarui setiap 5 menit selama panel dibuka. Cari nama emiten, insider, atau ticker sebagai kata kunci teks. Tanggal filing berbeda dari tanggal transaksi. Pengungkapan ini bukan bukti insider trading ilegal maupun prediksi keuntungan." : "US public filings refresh every 5 minutes while this panel is open. Search issuer, insider or ticker as full-text keywords. Filing dates differ from transaction dates. Disclosures are not proof of illegal trading or predicted profit."}</p>
    {Object.keys(baselines).length > 0 && <div className="space-y-2"><span className="text-xs">{id ? "Pencarian tersimpan" : "Saved searches"}</span><div className="flex gap-2 flex-wrap">{Object.keys(baselines).map((key) => {
      const split = key.indexOf(":"), savedDays = Number(key.slice(0, split)), keywords = key.slice(split + 1);
      return <button key={key} type="button" className="desk-button" aria-pressed={watchKey === key} onClick={() => { setInput(keywords); setSearch(keywords); setDays(savedDays); setOffset(0); setExpanded(null); }}>{keywords || (id ? "Semua filing" : "All filings")} · {savedDays} {id ? "hari" : "days"}</button>;
    })}</div></div>}
    <form onSubmit={(e) => { e.preventDefault(); setSearch(input.trim()); setOffset(0); setExpanded(null); }} className="flex flex-wrap items-end gap-3">
      <label className="text-xs flex-1 min-w-48">{id ? "Kata kunci" : "Keywords"}<input maxLength={80} className="block bg-zinc-900 border border-zinc-700 rounded p-2 mt-1 w-full" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Apple, NVIDIA, AAPL…" /></label>
      <label className="text-xs">{id ? "Periode" : "Window"}<select className="block bg-zinc-900 border border-zinc-700 rounded p-2 mt-1" value={days} onChange={(e) => { setDays(Number(e.target.value)); setOffset(0); }}>{[7, 30, 90].map((d) => <option value={d} key={d}>{d} {id ? "hari" : "days"}</option>)}</select></label>
      <button type="submit" className="desk-button">{id ? "Cari" : "Search"}</button><button type="button" className="desk-button" disabled={isFetching} onClick={() => void refetch()}>{id ? "Segarkan" : "Refresh"}</button><a className="desk-button" aria-disabled={!data?.filings.length} href={data?.filings.length ? `/api/insider-filings?${query}&format=csv` : undefined} download>CSV</a>
    </form>
    {data && <div className="flex gap-3 flex-wrap items-center text-xs"><button type="button" className="desk-button" disabled={offset !== 0 || !data.filings.length || data.source.status === "stale" || data.source.status === "unavailable"} onClick={() => markSeen(watchKey, data.filings.map((f) => f.accession))}>{baseline ? (id ? "Tandai halaman sudah dilihat" : "Mark page seen") : (id ? "Pantau pencarian ini" : "Watch this search")}</button>{baseline && <><button type="button" className="desk-button" onClick={() => stopWatch(watchKey)}>{id ? "Hentikan pantauan" : "Stop watching"}</button><span role="status">{data.filings.filter((f) => !baseline.includes(f.accession)).length} {id ? "filing belum dilihat di halaman ini" : "unseen filings on this page"}</span></>}<span>{id ? "Pantauan lokal browser; polling aktif hanya saat panel terbuka." : "Saved in this browser; polling runs only while the panel is open."}</span></div>}
    {isPending && <p role="status">{id ? "Mengambil filing SEC…" : "Fetching SEC filings…"}</p>}{error && <p role="alert">{error.message}</p>}
    {data && <><SourceStatus source={data.source} /><p className="text-xs text-zinc-400">{data.total.toLocaleString()}{data.totalIsLowerBound ? "+" : ""} {id ? "hasil; menampilkan" : "results; showing"} {data.filings.length} · {offset + 1}–{offset + data.filings.length}</p>
      {!data.filings.length && <p role="status">{data.source.status === "unavailable" ? (id ? "Sumber SEC tidak tersedia. Ini tidak berarti tidak ada transaksi." : "SEC unavailable. This does not mean no transactions occurred.") : (id ? "Tidak ada filing cocok dalam jendela ini." : "No matching filings in this window.")}</p>}
      {data.filings.map((filing) => {
        const context = filingContext(filing);
        return <article className="border border-zinc-700 rounded p-4 space-y-2" key={filing.accession}>
        <div className="flex flex-wrap justify-between gap-2"><strong className="text-sm break-words">{filing.names.join(" · ")}</strong><span className="text-xs font-mono">{filing.form}{baseline && !baseline.includes(filing.accession) ? " · NEW" : ""}</span></div>
        <p className="text-xs text-zinc-400">Filed: {filing.filedAt} · Period: {filing.period ?? "—"} · {filing.accession}</p>
        <p className="text-xs text-zinc-400">{context.amended ? (id ? "Amendemen · rekonsiliasi dengan filing asli. " : "Amendment · reconcile with the original. ") : ""}{context.periodGapDays !== null ? (id ? `${context.periodGapDays} hari kalender dari periode laporan ke filing; bukan uji keterlambatan legal.` : `${context.periodGapDays} calendar days from report period to filing; not a legal lateness test.`) : ""}</p>
        <div className="flex flex-wrap gap-3 text-xs"><a className="underline text-amber-300" href={filing.url} target="_blank" rel="noopener noreferrer">{id ? "Dokumen SEC asli" : "Original SEC document"}</a><button type="button" className="underline" aria-expanded={expanded === filing.accession} onClick={() => setExpanded(expanded === filing.accession ? null : filing.accession)}>{id ? "Detail transaksi" : "Transaction details"}</button></div>
        {expanded === filing.accession && <FilingDetails filing={filing} />}
      </article>; })}
      <div className="flex gap-3"><button type="button" className="desk-button" disabled={offset === 0 || isFetching} onClick={() => setOffset(offset - 100)}>{id ? "Sebelumnya" : "Previous"}</button><button type="button" className="desk-button" disabled={isFetching || offset >= 900 || offset + 100 >= data.total} onClick={() => setOffset(offset + 100)}>{id ? "Berikutnya" : "Next"}</button></div>
    </>}
    <a href="https://www.idx.co.id/id/perusahaan-tercatat/keterbukaan-informasi/" target="_blank" rel="noopener noreferrer" className="block text-xs underline text-amber-300">{id ? "Keterbukaan informasi resmi IDX (pemeriksaan manual)" : "Official IDX disclosures (manual review)"}</a>
    <p className="text-xs text-zinc-400">{id ? "Cakupan: SEC AS. Filing IDX/OJK belum terintegrasi; sinyal crypto adalah data pasar anonim. Maksimum penelusuran 1.000 hasil per pencarian, persempit kata kunci untuk cakupan lebih baik." : "Coverage: US SEC. IDX/OJK filings are not integrated; crypto signals use anonymous market data. Search is capped at 1,000 results; narrow keywords for better coverage."}</p>
  </div>;
}
