"use client";

import { useMemo, useState } from "react";
import { ArrowDownRight, ArrowUpRight, Minus, RefreshCw } from "lucide-react";
import { useAnalysis } from "../hooks/useAnalysis";
import { forecastCandles } from "../utils/analysis";
import { useTranslation } from "@/features/i18n";
import { TimeframeSelector } from "@/features/chart/components/TimeframeSelector";

export function analysisPrice(value: number) {
  return value.toLocaleString("en-US", { maximumFractionDigits: value >= 1000 ? 2 : value >= 1 ? 4 : 8 });
}

type Forecast = NonNullable<ReturnType<typeof forecastCandles>>;
function ForecastPlot({ forecast, id }: { forecast: Forecast; id: boolean }) {
  const { history, points } = forecast;
  const values = [...history, ...points.flatMap((p) => [p.lower, p.upper])];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const padding = Math.max((max - min) * .18, max * .002);
  const lower = min - padding;
  const range = max - min + padding * 2;
  const x = (index: number) => 14 + index / (history.length - 1 + points.length - 1) * 590;
  const y = (value: number) => 210 - (value - lower) / range * 184;
  const historyPath = history.map((value, i) => `${x(i)},${y(value)}`).join(" ");
  const pointX = (step: number) => x(history.length - 1 + step);
  const band = [...points.map((p) => `${pointX(p.step)},${y(p.upper)}`), ...points.toReversed().map((p) => `${pointX(p.step)},${y(p.lower)}`)].join(" ");
  return <div className="forecast-plot">
    <svg viewBox="0 0 680 260" role="img" aria-label={id ? "Harga historis dan proyeksi dengan rentang skenario satu standar deviasi" : "Historical prices and projection with a one standard deviation scenario range"}>
      {[0, 1, 2, 3].map((n) => <g key={n}><line x1="14" x2="604" y1={26 + n * 61.3} y2={26 + n * 61.3} className="plot-grid" /><text className="plot-price-label" x="614" y={30 + n * 61.3}>{analysisPrice(max + padding - range * n / 3)}</text></g>)}
      <polygon points={band} fill="var(--desk-accent)" fillOpacity=".13" />
      <polyline points={historyPath} fill="none" stroke="var(--desk-text)" strokeWidth="2" />
      <polyline points={points.map((p) => `${pointX(p.step)},${y(p.mid)}`).join(" ")} fill="none" stroke="var(--desk-accent)" strokeWidth="2" strokeDasharray="5 4" />
      <line x1={pointX(0)} x2={pointX(0)} y1="18" y2="218" stroke="var(--desk-muted)" strokeDasharray="3 5" />
      <circle cx={pointX(0)} cy={y(forecast.last)} r="4" fill="var(--desk-accent)" />
      <text x="14" y="248">{id ? "30 candle terakhir" : "Last 30 candles"}</text>
      <text x={pointX(0) - 8} y="248" textAnchor="end">{id ? "Terakhir" : "Latest"}</text>
      <text x="604" y="248" textAnchor="end">+{points.length - 1} {id ? "candle" : "bars"}</text>
    </svg>
  </div>;
}

export function AnalysisPanel({ mode = "analysis" }: { mode?: "analysis" | "prediction" | "summary" }) {
  const { locale } = useTranslation();
  const id = locale === "id";
  const { candles, analysis, symbol, timeframe, isPending, isFetching, isError, refetch } = useAnalysis();
  const [horizon, setHorizon] = useState(10);
  const forecast = useMemo(() => forecastCandles(candles, horizon), [candles, horizon]);
  const title = mode === "prediction" ? (id ? "Prediksi harga" : "Price projection") : (id ? "Analisa teknikal" : "Technical analysis");
  const required = mode === "prediction" ? 60 : 50;
  const available = mode === "prediction" ? forecast : analysis;
  const direction = analysis?.trend ?? "mixed";
  const trendLabels = id ? { up: "Tren naik", down: "Tren turun", mixed: "Tren campuran" } : { up: "Uptrend", down: "Downtrend", mixed: "Mixed trend" };
  const Icon = direction === "up" ? ArrowUpRight : direction === "down" ? ArrowDownRight : Minus;

  return <section className={`desk-panel analysis-panel ${mode === "summary" ? "analysis-summary" : ""}`}>
    <div className="desk-panel-head"><div><span className="desk-eyebrow">{symbol} · {timeframe}</span><h2>{title}</h2></div><button className="desk-icon-button" type="button" disabled={isFetching} onClick={() => refetch()} aria-label={id ? "Muat ulang analisa" : "Refresh analysis"}><RefreshCw size={16} className={isFetching ? "desk-spin" : ""} /></button></div>
    {mode !== "summary" && <div className="analysis-toolbar"><span>{id ? "Interval candle" : "Candle interval"}</span><TimeframeSelector /></div>}
    {!available ? <div className="desk-empty" role="status">
      <span className="desk-empty-symbol"><ActivityMark /></span>
      <h3>{isPending ? (id ? "Mengambil riwayat harga" : "Loading price history") : isError ? (id ? "Riwayat belum tersedia" : "Price history unavailable") : (id ? "Perlu lebih banyak candle" : "More candles needed")}</h3>
      <p>{isPending ? (id ? "Indikator dihitung setelah data diterima." : "Indicators will appear when data arrives.") : isError ? (id ? "Coba muat ulang atau pilih interval lain." : "Refresh or choose another interval.") : (id ? `Tersedia ${candles.length} candle valid. Minimal ${required} candle selesai diperlukan; candle sintetis tidak digunakan.` : `${candles.length} valid bars available. At least ${required} closed bars are required; synthetic bars are excluded.`)}</p>
      {!isPending && <button type="button" className="desk-button" onClick={() => refetch()} disabled={isFetching}>{id ? "Coba lagi" : "Try again"}</button>}
    </div> : mode === "prediction" && forecast ? <>
      <div className="prediction-heading"><div><span className="desk-muted">{id ? "Proyeksi tengah" : "Central projection"} · +{horizon} {id ? "candle" : "bars"}</span><strong>{analysisPrice(forecast.target.mid)}</strong><span className={forecast.target.mid >= forecast.last ? "desk-positive" : "desk-negative"}>{((forecast.target.mid / forecast.last - 1) * 100).toFixed(2)}% {id ? "dari penutupan terakhir" : "from last close"}</span></div><div className="desk-segment" aria-label={id ? "Horizon prediksi" : "Projection horizon"}>{[5, 10, 20].map((n) => <button type="button" key={n} aria-pressed={horizon === n} onClick={() => setHorizon(n)}>+{n}</button>)}</div></div>
      <ForecastPlot forecast={forecast} id={id} />
      <dl className="prediction-range"><div><dt>{id ? "Skenario bawah" : "Lower scenario"}</dt><dd>{analysisPrice(forecast.target.lower)}</dd></div><div><dt>{id ? "Penutupan terakhir" : "Last close"}</dt><dd>{analysisPrice(forecast.last)}</dd></div><div><dt>{id ? "Skenario atas" : "Upper scenario"}</dt><dd>{analysisPrice(forecast.target.upper)}</dd></div></dl>
      <div className="analysis-method"><strong>{id ? "Cara membaca proyeksi" : "Reading the projection"}</strong><p>{id ? "Menggunakan rata-rata log return dan simpangan baku dari 60 candle selesai. Garis putus-putus melanjutkan drift historis; area berwarna menunjukkan ±1 simpangan baku × √horizon. Rentang ini belum dikalibrasi sebagai probabilitas dan bukan jaminan harga." : "Uses the mean log return and standard deviation of 60 closed candles. The dashed line extends historical drift; the shaded area is ±1 standard deviation × √horizon. This range is not calibrated as a probability or a guaranteed price."}</p><p>{id ? "Horizon dihitung dalam candle, bukan waktu kalender; jeda sesi dan perubahan rezim pasar tidak dimodelkan." : "Horizon is measured in candles, not calendar time; session breaks and market regime changes are not modeled."}</p></div>
    </> : analysis ? <>
      <div className={`analysis-trend trend-${direction}`}><Icon size={24} /><div><strong>{trendLabels[direction]}</strong><p>{id ? "Hubungan harga penutupan, EMA 20 dan EMA 50." : "Relationship between the close, EMA 20 and EMA 50."}</p></div><span>{analysis.count} {id ? "candle" : "bars"}</span></div>
      <dl className="indicator-grid">
        <div><dt>RSI <span>14</span></dt><dd>{analysis.rsi.toFixed(1)}</dd><small>{analysis.rsi >= 70 ? (id ? "Jenuh beli" : "Overbought") : analysis.rsi <= 30 ? (id ? "Jenuh jual" : "Oversold") : (id ? "Netral" : "Neutral")}</small><div className="rsi-track"><i style={{ left: `${analysis.rsi}%` }} /></div></div>
        <div><dt>EMA <span>20</span></dt><dd>{analysisPrice(analysis.fast)}</dd><small>{analysis.last.close >= analysis.fast ? (id ? "Harga di atas EMA" : "Price above EMA") : (id ? "Harga di bawah EMA" : "Price below EMA")}</small></div>
        <div><dt>EMA <span>50</span></dt><dd>{analysisPrice(analysis.slow)}</dd><small>{id ? "Rata-rata tren menengah" : "Medium trend average"}</small></div>
        <div><dt>ATR <span>14</span></dt><dd>{analysis.atrPercent.toFixed(2)}%</dd><small>{analysisPrice(analysis.atr)} · {id ? "rentang rata-rata" : "average range"}</small></div>
      </dl>
      {mode !== "summary" && <><div className="analysis-levels"><div><span>Support · 20 {id ? "candle" : "bars"}</span><strong>{analysisPrice(analysis.support)}</strong></div><div className="level-track"><i style={{ left: `${analysis.resistance > analysis.support ? (analysis.last.close - analysis.support) / (analysis.resistance - analysis.support) * 100 : 50}%` }} /></div><div><span>Resistance · 20 {id ? "candle" : "bars"}</span><strong>{analysisPrice(analysis.resistance)}</strong></div></div><div className="analysis-method"><strong>{id ? "Interpretasi indikator" : "Indicator interpretation"}</strong><p>{id ? "RSI memakai smoothing Wilder. ATR menunjukkan rata-rata true range 14 candle, sebagai persentase harga. Support dan resistance adalah ekstrem 20 candle terakhir, bukan level yang pasti bertahan." : "RSI uses Wilder smoothing. ATR is the 14-bar average true range as a percentage of price. Support and resistance are the extremes of the last 20 bars, not guaranteed price barriers."}</p><p>{id ? "Momentum 20 candle" : "20-bar momentum"}: <b>{analysis.momentum > 0 ? "+" : ""}{analysis.momentum.toFixed(2)}%</b></p></div></>}
    </> : null}
    {available && <footer className="analysis-footnote">{isError ? (id ? "Pembaruan gagal · data tersimpan" : "Refresh failed · cached data") : (id ? "Candle selesai terakhir" : "Last closed candle")} · {new Date(candles[candles.length - 1].closeTime).toLocaleString(id ? "id-ID" : "en-GB")}<span>{id ? "Indikator historis, bukan rekomendasi transaksi." : "Historical indicators, not trade recommendations."}</span></footer>}
  </section>;
}

function ActivityMark() {
  return <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M2 23h7l5-14 5 18 5-10h6" stroke="currentColor" strokeWidth="1.5" /></svg>;
}
