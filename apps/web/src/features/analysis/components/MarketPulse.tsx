"use client";

import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import type { MarketSymbol } from "@gorengan/shared";
import { useMarketStore } from "@/stores/marketStore";
import { useTranslation } from "@/features/i18n";

export function MarketPulse({ symbols, loading = false }: { symbols: MarketSymbol[]; loading?: boolean }) {
  const { locale } = useTranslation();
  const id = locale === "id";
  const tickers = useMarketStore((s) => s.tickers);
  const changes = symbols.map((s) => tickers[s.id]?.changePercent24h).filter((n): n is number => typeof n === "number" && Number.isFinite(n));
  const up = changes.filter((n) => n > 0).length;
  const down = changes.filter((n) => n < 0).length;
  return <div className="market-pulse-strip">
    <div><span>{id ? "Instrumen" : "Instruments"}</span><strong>{loading ? "—" : symbols.length}</strong><small>{id ? "dalam workspace" : "in this workspace"}</small></div>
    <div><span><ArrowUpRight size={14} />{id ? "Naik" : "Advancing"}</span><strong className="desk-positive">{changes.length ? up : "—"}</strong><small>{id ? "perubahan 24 jam" : "24-hour change"}</small></div>
    <div><span><ArrowDownRight size={14} />{id ? "Turun" : "Declining"}</span><strong className="desk-negative">{changes.length ? down : "—"}</strong><small>{id ? "perubahan 24 jam" : "24-hour change"}</small></div>
    <div><span><Minus size={14} />{id ? "Cakupan harga" : "Quote coverage"}</span><strong>{symbols.length ? Math.round(changes.length / symbols.length * 100) : "—"}<em>%</em></strong><small>{changes.length} / {symbols.length} {id ? "instrumen" : "instruments"}</small></div>
  </div>;
}

export function MarketMovers({ symbols, onSelect }: { symbols: MarketSymbol[]; onSelect: () => void }) {
  const { locale } = useTranslation();
  const id = locale === "id";
  const tickers = useMarketStore((s) => s.tickers);
  const setSymbol = useMarketStore((s) => s.setSelectedSymbol);
  const movers = symbols.flatMap((symbol) => {
    const change = tickers[symbol.id]?.changePercent24h;
    return typeof change === "number" && Number.isFinite(change) ? [{ ...symbol, change }] : [];
  }).sort((a, b) => Math.abs(b.change) - Math.abs(a.change)).slice(0, 5);
  return <section className="desk-panel movers-panel"><div className="desk-panel-head"><div><span className="desk-eyebrow">24H</span><h2>{id ? "Pergerakan terbesar" : "Top movers"}</h2></div></div>{movers.length ? <ol>{movers.map((symbol, i) => <li key={symbol.id}><button type="button" onClick={() => { setSymbol(symbol.id); onSelect(); }}><span className="mover-rank">{String(i + 1).padStart(2, "0")}</span><span><strong>{symbol.id}</strong><small>{symbol.name}</small></span><b className={symbol.change >= 0 ? "desk-positive" : "desk-negative"}>{symbol.change > 0 ? "+" : ""}{symbol.change.toFixed(2)}%</b></button></li>)}</ol> : <div className="desk-empty"><p>{id ? "Menunggu perubahan harga dari penyedia data." : "Waiting for price changes from the data provider."}</p></div>}</section>;
}
