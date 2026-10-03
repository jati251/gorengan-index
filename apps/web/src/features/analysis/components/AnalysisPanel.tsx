"use client";

import { useMemo, useState } from "react";
import { ArrowDownRight, ArrowUpRight, Minus, RefreshCw } from "lucide-react";
import { useAnalysis } from "../hooks/useAnalysis";
import { forecastCandles, forecastEvidence, type ForecastBlockReason } from "../utils/analysis";
import { timeframeToMs } from "@gorengan/shared";
import { useNow } from "@/hooks/useNow";
import { useTranslation } from "@/features/i18n";
import { TimeframeSelector } from "@/features/chart/components/TimeframeSelector";

export function analysisPrice(value: number) {
  return value.toLocaleString("en-US", { maximumFractionDigits: value >= 1000 ? 2 : value >= 1 ? 4 : 8 });
}

type Forecast = NonNullable<ReturnType<typeof forecastCandles>>;

function ForecastPlot({ forecast, id }: { forecast: Forecast; id: boolean }) {
  const { history, points, points95, metrics } = forecast;
  const p95 = points95 ?? points;
  const values = [
    ...history,
    ...points.flatMap((p) => [p.lower, p.upper]),
    ...p95.flatMap((p) => [p.lower, p.upper]),
    metrics.pivotLevels.r1,
    metrics.pivotLevels.s1,
  ];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const padding = Math.max((max - min) * .18, max * .002);
  const lower = min - padding;
  const range = max - min + padding * 2;
  const x = (index: number) => 14 + index / (history.length - 1 + points.length - 1) * 590;
  const y = (value: number) => 210 - (value - lower) / range * 184;

  const historyPath = history.map((value, i) => `${x(i)},${y(value)}`).join(" ");
  const pointX = (step: number) => x(history.length - 1 + step);

  // Two-sigma outer scenario envelope
  const band95 = [...p95.map((p) => `${pointX(p.step)},${y(p.upper)}`), ...p95.toReversed().map((p) => `${pointX(p.step)},${y(p.lower)}`)].join(" ");
  // 68% (1-sigma) inner confidence band
  const band68 = [...points.map((p) => `${pointX(p.step)},${y(p.upper)}`), ...points.toReversed().map((p) => `${pointX(p.step)},${y(p.lower)}`)].join(" ");

  // Bull & Bear trajectory paths
  const bullTarget = forecast.scenarios.bull.targetPrice;
  const bearTarget = forecast.scenarios.bear.targetPrice;
  const bullPath = points.map((p) => `${pointX(p.step)},${y(forecast.last + (bullTarget - forecast.last) * (p.step / (points.length - 1)))}`).join(" ");
  const bearPath = points.map((p) => `${pointX(p.step)},${y(forecast.last + (bearTarget - forecast.last) * (p.step / (points.length - 1)))}`).join(" ");

  const r1Y = y(metrics.pivotLevels.r1);
  const s1Y = y(metrics.pivotLevels.s1);

  return <div className="forecast-plot">
    <svg viewBox="0 0 680 260" role="img" aria-label={id ? "Harga historis, skenario historis, dan pita deviasi standar ganda" : "Historical prices, historical scenario envelopes and dual standard deviation envelope"}>
      {[0, 1, 2, 3].map((n) => <g key={n}><line x1="14" x2="604" y1={26 + n * 61.3} y2={26 + n * 61.3} className="plot-grid" /><text className="plot-price-label" x="614" y={30 + n * 61.3}>{analysisPrice(max + padding - range * n / 3)}</text></g>)}

      {/* Two-sigma scenario envelope */}
      <polygon points={band95} fill="var(--desk-accent)" fillOpacity=".06" />
      {/* One-sigma scenario envelope */}
      <polygon points={band68} fill="var(--desk-accent)" fillOpacity=".14" />

      {/* Historical line */}
      <polyline points={historyPath} fill="none" stroke="var(--desk-text)" strokeWidth="2" />

      {/* Scenario lines */}
      <polyline points={bullPath} fill="none" stroke="#10b981" strokeWidth="1.5" strokeDasharray="3 3" opacity=".8" />
      <polyline points={bearPath} fill="none" stroke="#f43f5e" strokeWidth="1.5" strokeDasharray="3 3" opacity=".8" />

      {/* Central expected drift path */}
      <polyline points={points.map((p) => `${pointX(p.step)},${y(p.mid)}`).join(" ")} fill="none" stroke="var(--desk-accent)" strokeWidth="2" strokeDasharray="5 4" />

      {/* Pivot lines */}
      {r1Y >= 18 && r1Y <= 220 && <line x1={pointX(0)} x2="604" y1={r1Y} y2={r1Y} stroke="#10b981" strokeDasharray="2 4" strokeWidth="1" opacity=".5" />}
      {s1Y >= 18 && s1Y <= 220 && <line x1={pointX(0)} x2="604" y1={s1Y} y2={s1Y} stroke="#f43f5e" strokeDasharray="2 4" strokeWidth="1" opacity=".5" />}

      {/* Separator line between history and forecast */}
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
  const [costInput, setCostInput] = useState("20");
  const now = useNow();
  const forecast = useMemo(() => forecastCandles(candles, horizon), [candles, horizon]);
  const latestClose = candles.at(-1)?.closeTime;
  const evidence = forecast ? forecastEvidence(forecast.metrics.evaluation, (forecast.target.mid / forecast.last - 1) * 100, {
    fresh: latestClose !== undefined && latestClose <= now && now - latestClose <= 2 * timeframeToMs(timeframe),
    refreshFailed: isError, costBps: costInput.trim() ? Number(costInput) : NaN,
  }) : null;
  const evidenceReasons: Record<ForecastBlockReason, string> = id ? {
    refresh_failed: "Pembaruan data gagal.", stale: "Candle terakhir sudah kedaluwarsa untuk interval ini.",
    insufficient_tests: "Perlu minimal 30 hasil uji dan 30 hasil arah yang tidak datar.", baseline: "Error model belum minimal 10% lebih rendah daripada baseline harga tetap.",
    recent_baseline: "Model belum mengalahkan baseline dalam 10 hasil uji terbaru.", direction: "Ketepatan arah historis belum di atas 50%.", cost: "Perubahan proyeksi belum melampaui estimasi biaya, atau input biaya tidak valid.",
  } : {
    refresh_failed: "Data refresh failed.", stale: "The last closed bar is too old for this interval.",
    insufficient_tests: "At least 30 test outcomes and 30 nonflat direction outcomes are required.", baseline: "Model error is not at least 10% lower than the last-price baseline.",
    recent_baseline: "The model does not beat the baseline across the ten most recent outcomes.", direction: "Historical direction accuracy is not above 50%.", cost: "Projected movement does not exceed estimated costs, or the cost input is invalid.",
  };
  const title = mode === "prediction" ? (id ? "Prediksi harga & skenario kuantitatif" : "Price forecast & quant scenarios") : (id ? "Analisa teknikal" : "Technical analysis");
  const required = mode === "prediction" ? 60 : 50;
  const available = mode === "prediction" ? forecast : analysis;
  const direction = analysis?.trend ?? "mixed";
  const trendLabels = id ? { up: "Tren naik", down: "Tren turun", mixed: "Tren campuran" } : { up: "Uptrend", down: "Downtrend", mixed: "Mixed trend" };
  const Icon = direction === "up" ? ArrowUpRight : direction === "down" ? ArrowDownRight : Minus;

  return <section className={`desk-panel analysis-panel ${mode === "summary" ? "analysis-summary" : ""}`}>
    <div className="desk-panel-head"><div><span className="desk-eyebrow">{symbol} · {timeframe}</span><h2>{title}</h2></div><button className="desk-icon-button" type="button" disabled={isFetching} onClick={() => refetch()} aria-label={id ? "Muat ulang analisa" : "Refresh analysis"}><RefreshCw size={16} className={isFetching ? "desk-spin" : ""} /></button></div>
    {mode !== "summary" && <div className="analysis-toolbar"><span>{id ? "Interval candle" : "Candle interval"}</span><TimeframeSelector /></div>}
    {!available ? <div className="desk-empty" role="status">
      <span className="desk-empty-symbol"><ActivityMark isPending={isPending} /></span>
      <h3>{isPending ? (id ? "Mengambil riwayat harga" : "Loading price history") : isError ? (id ? "Riwayat belum tersedia" : "Price history unavailable") : (id ? "Perlu lebih banyak candle" : "More candles needed")}</h3>
      <p>{isPending ? (id ? "Indikator dihitung setelah data diterima." : "Indicators will appear when data arrives.") : isError ? (id ? "Coba muat ulang atau pilih interval lain." : "Refresh or choose another interval.") : (id ? `Tersedia ${candles.length} candle valid. Minimal ${required} candle selesai diperlukan; candle sintetis tidak digunakan.` : `${candles.length} valid bars available. At least ${required} closed bars are required; synthetic bars are excluded.`)}</p>
      {!isPending && <button type="button" className="desk-button" onClick={() => refetch()} disabled={isFetching}>{id ? "Coba lagi" : "Try again"}</button>}
    </div> : mode === "prediction" && forecast ? <>
      <div className="analysis-method" role="status">
        <strong>{evidence?.eligible
          ? (id ? "Lolos penyaringan historis · perlu validasi lebih lanjut" : "Historical screening passed · further validation needed")
          : (id ? "Belum ada arah prediksi yang didukung penyaringan" : "No direction supported by the screening rules")}</strong>
        <p>{id ? "Aturan ini menyaring bukti historis pada interval dan horizon yang dipilih. Skenario harga tetap tersedia untuk eksplorasi." : "These rules screen historical evidence at the selected interval and horizon. Price scenarios remain available for exploration."}</p>
        {!!evidence?.reasons.length && <ul className="list-disc pl-5">{evidence.reasons.map((reason) => <li key={reason}>{evidenceReasons[reason]}</li>)}</ul>}
        <label className="block mt-3">{id ? "Estimasi total biaya + slippage (basis poin)" : "Estimated total costs + slippage (basis points)"}
          <input type="number" min="0" step="1" value={costInput} onChange={(event) => setCostInput(event.target.value)} className="block w-32 mt-1 p-2 bg-zinc-900 border border-zinc-600 rounded" />
        </label>
        <p>{id ? "20 bp = 0,20% untuk seluruh transaksi. Penyaringan ini belum merupakan backtest profit atau probabilitas terkalibrasi." : "20 bp = 0.20% for the entire round trip. Passing this screen is not a profitability backtest or calibrated probability."}</p>
      </div>
      <div className="prediction-heading">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="desk-muted">{id ? "Skenario tengah" : "Central scenario"} · +{horizon} {id ? "candle" : "bars"}</span>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              {forecast.metrics.evaluation.samples} {id ? "uji historis" : "historical tests"}
            </span>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-300">
              {id ? "Regime" : "Regime"}: {forecast.metrics.volatilityRegime}
            </span>
          </div>
          <strong>{analysisPrice(forecast.target.mid)}</strong>
          <span className={evidence?.eligible ? (forecast.target.mid >= forecast.last ? "desk-positive" : "desk-negative") : "desk-muted"}>
            {((forecast.target.mid / forecast.last - 1) * 100).toFixed(2)}% {id ? "dari penutupan terakhir" : "from last close"}
          </span>
        </div>
        <div className="desk-segment" aria-label={id ? "Horizon prediksi" : "Projection horizon"}>
          {[5, 10, 20].map((n) => <button type="button" key={n} aria-pressed={horizon === n} onClick={() => setHorizon(n)}>+{n}</button>)}
        </div>
      </div>

      <ForecastPlot forecast={forecast} id={id} />

      {/* Multi-Scenario Probability Matrix */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 my-4">
        <div className="p-3 rounded-xl bg-zinc-900/60 border border-emerald-500/20 space-y-1">
          <div className="flex justify-between items-center text-xs">
            <span className="font-semibold text-emerald-400 font-mono">BULL SCENARIO</span>
            <span className="text-[11px] font-bold font-mono px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300">
              {forecast.scenarios.bull.weight}% {id ? "Bobot heuristik" : "Heuristic weight"}
            </span>
          </div>
          <div className="text-base font-bold font-mono text-zinc-100">
            {analysisPrice(forecast.scenarios.bull.targetPrice)}
          </div>
          <div className="text-[11px] font-mono text-emerald-400">
            +{Math.abs(forecast.scenarios.bull.changePercent).toFixed(2)}%
          </div>
          <p className="text-[11px] text-zinc-400 leading-tight">
            {id ? "Uji resistance R1 & ekspansi volatilitas naik." : forecast.scenarios.bull.rationale}
          </p>
        </div>

        <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-700/60 space-y-1">
          <div className="flex justify-between items-center text-xs">
            <span className="font-semibold text-zinc-300 font-mono">BASE SCENARIO</span>
            <span className="text-[11px] font-bold font-mono px-1.5 py-0.5 rounded bg-zinc-700 text-zinc-200">
              {forecast.scenarios.base.weight}% {id ? "Bobot heuristik" : "Heuristic weight"}
            </span>
          </div>
          <div className="text-base font-bold font-mono text-zinc-100">
            {analysisPrice(forecast.scenarios.base.targetPrice)}
          </div>
          <div className={`text-[11px] font-mono ${forecast.scenarios.base.changePercent >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
            {forecast.scenarios.base.changePercent >= 0 ? "+" : ""}{forecast.scenarios.base.changePercent.toFixed(2)}%
          </div>
          <p className="text-[11px] text-zinc-400 leading-tight">
            {id ? "Jalur ekuilibrium drift historis normal." : forecast.scenarios.base.rationale}
          </p>
        </div>

        <div className="p-3 rounded-xl bg-zinc-900/60 border border-rose-500/20 space-y-1">
          <div className="flex justify-between items-center text-xs">
            <span className="font-semibold text-rose-400 font-mono">BEAR SCENARIO</span>
            <span className="text-[11px] font-bold font-mono px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-300">
              {forecast.scenarios.bear.weight}% {id ? "Bobot heuristik" : "Heuristic weight"}
            </span>
          </div>
          <div className="text-base font-bold font-mono text-zinc-100">
            {analysisPrice(forecast.scenarios.bear.targetPrice)}
          </div>
          <div className="text-[11px] font-mono text-rose-400">
            -{Math.abs(forecast.scenarios.bear.changePercent).toFixed(2)}%
          </div>
          <p className="text-[11px] text-zinc-400 leading-tight">
            {id ? "Retest mean-reversion ke support S1 / EMA 50." : forecast.scenarios.bear.rationale}
          </p>
        </div>
      </div>

      {/* Quantitative Desk & Accuracy Metrics */}
      <dl className="prediction-range">
        <div>
          <dt>{id ? "Akurasi arah di luar periode latih" : "Out-of-sample direction accuracy"}</dt>
          <dd className="font-mono text-cyan-400">{forecast.metrics.directionalAccuracy?.toFixed(1) ?? "—"}%</dd>
        </div>
        <div>
          <dt>{id ? "Volatilitas Parkinson (Rentang HL)" : "Parkinson Volatility (HL)"}</dt>
          <dd className="font-mono text-zinc-200">{(forecast.metrics.parkinsonSigma * 100).toFixed(2)}%</dd>
        </div>
        <div>
          <dt>{id ? "Level referensi pivot" : "Pivot reference level"}</dt>
          <dd className="font-mono text-rose-400">{analysisPrice(forecast.metrics.invalidationPrice)}</dd>
        </div>
      </dl>

      <div className="analysis-method">
        <p>{id ? "10 hasil uji terbaru" : "Ten most recent outcomes"}: n={forecast.metrics.evaluation.recentSamples}; MAPE {forecast.metrics.evaluation.recentMape?.toFixed(2) ?? "—"}% · baseline {forecast.metrics.evaluation.recentBaselineMape?.toFixed(2) ?? "—"}%. {id ? "Perbaikan error keseluruhan dibanding baseline" : "Overall error improvement against baseline"}: {evidence?.improvementPercent?.toFixed(1) ?? "—"}%.</p>
        <p>{id ? "Evaluasi rolling, jendela hasil tidak tumpang tindih" : "Rolling evaluation, non-overlapping outcomes"}: n={forecast.metrics.evaluation.samples}; MAPE {forecast.metrics.evaluation.mape?.toFixed(2) ?? "—"}% · {id ? "baseline harga tetap" : "last-price baseline"} {forecast.metrics.evaluation.baselineMape?.toFixed(2) ?? "—"}% · {id ? "cakupan pita 2σ" : "2σ coverage"} {forecast.metrics.evaluation.envelopeCoverage?.toFixed(1) ?? "—"}%. {id ? "Belum memperhitungkan biaya transaksi. Sampel kecil belum membuktikan keunggulan." : "Excludes trading costs. Small samples do not establish an edge."}</p>
        <strong>{id ? "Riset Kuantitatif & Panduan Pertimbangan Riil" : "Quantitative Research & Real Consideration Framework"}</strong>
        <p>
          {id
            ? "Proyeksi memakai rata-rata log return 60 candle dan deviasi close-to-close. Pita 1σ/2σ adalah skenario, bukan probabilitas 68%/95% terkalibrasi. Bobot bull/base/bear adalah heuristik. Volatilitas Parkinson ditampilkan terpisah dan tidak mengubah jalur proyeksi."
            : "Projection uses 60-bar mean log returns and close-to-close deviation. The 1σ/2σ envelopes are scenarios, not calibrated 68%/95% probabilities. Bull/base/bear weights are heuristic. Parkinson volatility is displayed separately and does not drive this projection."}
        </p>
        <p>
          {id
            ? `Titik Pivot: P ${analysisPrice(forecast.metrics.pivotLevels.pivot)} · R1 ${analysisPrice(forecast.metrics.pivotLevels.r1)} · S1 ${analysisPrice(forecast.metrics.pivotLevels.s1)}. Jika harga menembus level referensi (${analysisPrice(forecast.metrics.invalidationPrice)}), tinjau kembali skenario dan risiko.`
            : `Pivot Reference: P ${analysisPrice(forecast.metrics.pivotLevels.pivot)} · R1 ${analysisPrice(forecast.metrics.pivotLevels.r1)} · S1 ${analysisPrice(forecast.metrics.pivotLevels.s1)}. Breaching the invalidation barrier (${analysisPrice(forecast.metrics.invalidationPrice)}) calls for a review of this illustrative scenario.`}
        </p>
      </div>
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

function ActivityMark({ isPending = false }: { isPending?: boolean }) {
  return <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true" className={isPending ? "desk-pulse-ekg text-amber-400" : ""}><path d="M2 23h7l5-14 5 18 5-10h6" stroke="currentColor" strokeWidth="1.5" /></svg>;
}
