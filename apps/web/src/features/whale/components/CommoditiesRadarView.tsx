"use client";
import { useState } from "react";
import type { WhaleRadarData } from "../types";
import { formatUsd, formatPercent } from "../utils/formatters";
import { SourceStatus } from "./SourceStatus";
import { useTranslation } from "@/features/i18n";

export function CommoditiesRadarView({ data }: { data: WhaleRadarData }) {
  const id = useTranslation().locale === "id";
  const [filter, setFilter] = useState("ALL");
  const filteredCommodities = data.commodities.allCommodities.filter((c) => filter === "ALL" || c.assetType === filter);

  return (
    <div className="space-y-4">
      <div className="flex gap-4 flex-wrap items-center justify-between">
        <label className="text-sm flex items-center gap-2">
          <span className="font-semibold text-zinc-300">{id ? "Komoditas" : "Commodity"}</span>
          <select
            aria-label="Commodity filter"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="bg-zinc-900 border border-zinc-700 rounded-lg p-2 font-mono text-zinc-100 text-sm focus:border-amber-400 focus:outline-hidden"
          >
            {["ALL", "GOLD", "SILVER", "OIL"].map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
        </label>
        <div className="text-sm font-mono text-zinc-300">
          Gold / silver ratio: <span className="font-bold text-amber-400">{data.commodities.goldSilverRatio?.toFixed(2) ?? "—"}</span>
        </div>
      </div>
      <p className="text-xs text-zinc-400">
        {id
          ? "Rasio memakai kontrak futures dalam USD per troy ounce, bukan harga ETF per saham. Kontrak bergulir dan data dapat tertunda."
          : "Ratio uses futures quoted in USD per troy ounce, not ETF share prices. Contracts roll and quotes may be delayed."}
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        {filteredCommodities.map((c) => (
          <article
            key={c.id}
            className="p-4 rounded-xl border border-zinc-700/80 bg-zinc-900/40 space-y-2 hover:border-zinc-600 transition-colors ui-fade-in"
          >
            <h3 className="font-bold text-zinc-100">{c.symbol} · {c.name}</h3>
            <p className="text-xl font-mono mt-1 text-zinc-100">
              {formatUsd(c.price)}{" "}
              <span className="text-xs text-zinc-400">
                {c.unit} ·{" "}
                <span className={c.changePercent24h != null && c.changePercent24h >= 0 ? "text-emerald-400 font-semibold" : "text-rose-400 font-semibold"}>
                  {formatPercent(c.changePercent24h)}
                </span>
              </span>
            </p>
            <SourceStatus source={c.source} asOf={c.asOf} />
          </article>
        ))}
      </div>
    </div>
  );
}
