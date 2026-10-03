"use client";
import type { WhaleRadarData } from "../types";
import { formatUsd, formatPercent, formatBtc } from "../utils/formatters";
import { useTranslation } from "@/features/i18n";
import { SourceStatus } from "./SourceStatus";
export function BlackRockEtfView({ data }: { data: WhaleRadarData }) {
  const id = useTranslation().locale === "id";
  return <div className="space-y-4">
    <p className="text-sm text-zinc-300">{id ? "Harga ETF adalah kuotasi tertunda atau penutupan terakhir. Volume saham bukan arus dana bersih ETF. Cadangan IBIT dibaca dari CSV resmi BlackRock; net inflow belum tersedia." : "ETF prices are delayed quotes or the last close. Share volume is not ETF net flow. IBIT reserves come from the official BlackRock CSV; net flows are unavailable."}</p>
    <div className="p-4 border border-zinc-700 rounded"><h3 className="font-bold">IBIT · {id ? "Kepemilikan dilaporkan penerbit" : "Issuer-reported holdings"}</h3><p>{formatBtc(data.etfSummary.ibit.btcHeld)} · {formatUsd(data.etfSummary.ibit.aumUsd, true)}</p><p className="text-xs text-zinc-400">{id ? "Tanggal laporan" : "Disclosure date"}: {data.etfSummary.holdingsAsOf ?? "—"}. {id ? "Nilai pasar kepemilikan BTC, bukan total AUM semua ETF." : "BTC holdings market value, not all-ETF AUM."}</p></div>
    <div className="grid gap-3 md:grid-cols-2">{data.etfSummary.allEtfs.map((etf) => <article key={etf.symbol} className="p-4 rounded-lg border border-zinc-700 space-y-2">
      <h3 className="font-bold text-zinc-100">{etf.symbol} · {etf.name}</h3><p className="text-xs text-zinc-400">{etf.issuer}</p>
      <div className="text-xl font-mono text-zinc-100">{formatUsd(etf.price)} <span className="text-sm">{formatPercent(etf.changePercent24h)}</span></div>
      <p className="text-xs text-zinc-300">{id ? "Volume sesi (saham)" : "Session volume (shares)"}: {etf.volume24h?.toLocaleString() ?? "—"}</p>
      <SourceStatus source={etf.source} asOf={etf.asOf} />
    </article>)}</div>
    <a href="https://www.ishares.com/us/products/333011/ishares-bitcoin-trust-etf" target="_blank" rel="noopener noreferrer" className="text-sm underline text-amber-300">{id ? "Laporan resmi IBIT / BlackRock" : "Official IBIT / BlackRock disclosures"}</a>
  </div>;
}
