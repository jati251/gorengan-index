"use client";
import { useState } from "react";
import type { WhaleRadarData } from "../types";
import { formatUsd, formatPercent } from "../utils/formatters";
import { SourceStatus } from "./SourceStatus";
import { useTranslation } from "@/features/i18n";
export function CommoditiesRadarView({ data }: { data: WhaleRadarData }) {
  const id = useTranslation().locale === "id";
  const [filter, setFilter] = useState("ALL");
  return <div className="space-y-4"><div className="flex gap-4 flex-wrap items-center">
    <label className="text-sm">{id ? "Komoditas" : "Commodity"} <select aria-label="Commodity filter" value={filter} onChange={(e) => setFilter(e.target.value)} className="bg-zinc-900 border rounded p-2">{["ALL", "GOLD", "SILVER", "OIL"].map((f) => <option key={f}>{f}</option>)}</select></label>
    <p className="text-sm text-zinc-300">Gold / silver futures: {data.commodities.goldSilverRatio?.toFixed(2) ?? "—"}</p></div>
    <p className="text-xs text-zinc-400">{id ? "Rasio memakai kontrak futures dalam USD per troy ounce, bukan harga ETF per saham. Kontrak bergulir dan data dapat tertunda." : "Ratio uses futures quoted in USD per troy ounce, not ETF share prices. Contracts roll and quotes may be delayed."}</p>
    <div className="grid gap-3 md:grid-cols-2">{data.commodities.allCommodities.filter((c) => filter === "ALL" || c.assetType === filter).map((c) => <article key={c.id} className="p-4 rounded border border-zinc-700">
      <h3 className="font-bold">{c.symbol} · {c.name}</h3><p className="text-xl font-mono mt-2">{formatUsd(c.price)} <span className="text-xs">{c.unit} · {formatPercent(c.changePercent24h)}</span></p>
      <SourceStatus source={c.source} asOf={c.asOf} />
    </article>)}</div></div>;
}
