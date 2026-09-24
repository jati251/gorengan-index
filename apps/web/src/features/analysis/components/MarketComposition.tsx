"use client";

import { useMemo, useState } from "react";
import type { MarketSymbol } from "@gorengan/shared";
import { useMarketStore } from "@/stores/marketStore";
import { useWatchlistStore } from "@/stores/watchlistStore";
import { useTranslation } from "@/features/i18n";
import { marketComposition } from "../utils/analysis";

const colors: Record<string, string> = { crypto: "#3fdf97", fx: "#26a6ac", us_stocks: "#f4c41b", idx_stocks: "#eb619f", other: "#b4c5d4", up: "#3fdf97", down: "#eb619f", flat: "#f4c41b", missing: "#b4c5d4" };

export function MarketComposition({ symbols, compact = false, loading = false }: { symbols: MarketSymbol[]; compact?: boolean; loading?: boolean }) {
  const { locale } = useTranslation();
  const id = locale === "id";
  const tickers = useMarketStore((s) => s.tickers);
  const watchlist = useWatchlistStore((s) => s.watchlist);
  const [scope, setScope] = useState("all");
  const [mode, setMode] = useState<"assets" | "breadth">("assets");
  const [selected, setSelected] = useState<string | null>(null);
  const included = useMemo(() => scope === "watchlist" ? symbols.filter((s) => watchlist.includes(s.id)) : symbols, [scope, symbols, watchlist]);
  const data = marketComposition(included, tickers, mode);
  const total = data.reduce((sum, item) => sum + item.count, 0);
  const active = data.find((item) => item.key === selected && item.count > 0);
  const labels: Record<string, string> = id ? { crypto: "Crypto", fx: "Forex", us_stocks: "Saham AS", idx_stocks: "Saham IDX", other: "Lainnya", up: "Naik", down: "Turun", flat: "Tetap", missing: "Belum ada harga" } : { crypto: "Crypto", fx: "Forex", us_stocks: "US stocks", idx_stocks: "IDX stocks", other: "Other", up: "Advancing", down: "Declining", flat: "Unchanged", missing: "No price data" };
  const segments = data.map((item, index) => ({
    ...item,
    offset: total ? data.slice(0, index).reduce((sum, part) => sum + part.count, 0) / total * 100 : 0,
    percent: total ? item.count / total * 100 : 0,
  }));
  return <section className={`desk-panel composition-panel ${compact ? "composition-compact" : ""}`}>
    <div className="desk-panel-head"><div><span className="desk-eyebrow">{id ? "Distribusi instrumen" : "Instrument distribution"}</span><h2>{id ? "Komposisi pasar" : "Market composition"}</h2></div>{!compact && <select aria-label={id ? "Cakupan komposisi" : "Composition scope"} value={scope} onChange={(e) => { setScope(e.target.value); setSelected(null); }}><option value="all">{id ? "Semua pasar" : "All markets"}</option><option value="watchlist">Watchlist</option></select>}</div>
    <div className="composition-controls desk-segment"><button type="button" aria-pressed={mode === "assets"} onClick={() => { setMode("assets"); setSelected(null); }}>{id ? "Kelas aset" : "Asset class"}</button><button type="button" aria-pressed={mode === "breadth"} onClick={() => { setMode("breadth"); setSelected(null); }}>{id ? "Naik / turun" : "Market breadth"}</button></div>
    {loading || !total ? <div className="desk-empty" role="status"><h3>{loading ? (id ? "Memuat instrumen" : "Loading instruments") : (id ? "Belum ada instrumen" : "No instruments yet")}</h3><p>{id ? "Tambahkan aset ke watchlist atau pilih semua pasar." : "Add an asset to your watchlist or select all markets."}</p></div> : <div className="composition-body">
      <div className="composition-donut"><svg viewBox="0 0 220 220" role="img" aria-label={segments.filter((s) => s.count).map((s) => `${labels[s.key]}: ${s.count} (${s.percent.toFixed(1)}%)`).join(", ")}><circle cx="110" cy="110" r="82" fill="none" stroke="var(--desk-line)" strokeWidth="24" />{segments.filter((item) => item.count > 0).map((item) => <circle key={item.key} cx="110" cy="110" r="82" pathLength="100" fill="none" stroke={colors[item.key]} strokeWidth={active?.key === item.key ? 30 : 24} strokeDasharray={`${item.percent} ${100 - item.percent}`} strokeDashoffset={-item.offset} transform="rotate(-90 110 110)" opacity={!active || active.key === item.key ? 1 : .3} />)}</svg><div><strong>{active ? active.count : total}</strong><span>{active ? labels[active.key] : (id ? "instrumen" : "instruments")}</span></div></div>
      <div className="composition-legend">{segments.filter((item) => item.count > 0).map((item) => <button type="button" key={item.key} aria-pressed={active?.key === item.key} onClick={() => setSelected(selected === item.key ? null : item.key)}><i style={{ background: colors[item.key] }} /><span>{labels[item.key]}</span><b>{item.count}</b><small>{item.percent.toFixed(1)}%</small></button>)}</div>
    </div>}
    <p className="composition-note">{mode === "assets" ? (id ? "Proporsi jumlah instrumen, bukan nilai portofolio." : "Share of instrument count, not portfolio value.") : (id ? "Perubahan 24 jam. Data yang belum tersedia dihitung terpisah." : "24-hour change. Missing quotes are counted separately.")}</p>
  </section>;
}
