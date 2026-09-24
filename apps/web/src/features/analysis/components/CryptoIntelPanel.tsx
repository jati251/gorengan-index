"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { TIMEFRAME_MS } from "@gorengan/shared";
import { useAnalysis } from "../hooks/useAnalysis";
import { marketSignals, positionPlan, type RiskInput } from "../utils/cryptoSignals";
import type { CryptoFlow } from "../utils/cryptoFlow";
import { TimeframeSelector } from "@/features/chart/components/TimeframeSelector";
import { useTranslation } from "@/features/i18n";
import { useMarketStore } from "@/stores/marketStore";

const number = (n: number | null | undefined, digits = 2) => n == null || !Number.isFinite(n) ? "—" : n.toLocaleString("en-US", { maximumFractionDigits: digits });

export function CryptoIntelPanel() {
  const symbol = useMarketStore((s) => s.selectedSymbol);
  return <CryptoIntelWorkspace key={symbol} />;
}

function CryptoIntelWorkspace() {
  const { locale } = useTranslation();
  const id = locale === "id";
  const t = (a: string, b: string) => id ? a : b;
  const history = useAnalysis();
  const { symbol, timeframe, candles } = history;
  const supported = /^[A-Z0-9]{2,15}-USDT$/.test(symbol);
  const [now, setNow] = useState(() => Date.now());
  const [threshold, setThreshold] = useState(100000);
  const [input, setInput] = useState<RiskInput>({ capital: 1000, riskPercent: 1, entry: 0, stop: 0, target: 0, feePercent: .1, slippagePercent: .1, lotSize: .000001 });
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 10000); return () => clearInterval(timer); }, []);
  const flow = useQuery<CryptoFlow>({
    queryKey: ["crypto-intel", symbol], enabled: supported, staleTime: 15000, refetchInterval: 20000, retry: 1,
    queryFn: async ({ signal }) => {
      const response = await fetch(`/api/crypto-intel?symbol=${encodeURIComponent(symbol)}`, { signal });
      if (!response.ok) throw new Error("Crypto data unavailable");
      return response.json();
    },
  });
  const signals = marketSignals(candles, symbol, timeframe, now);
  const staleCandles = !signals || history.isError || now - signals.last.closeTime > TIMEFRAME_MS[timeframe] * 2;
  const staleFlow = !flow.data || flow.isError || now - flow.data.fetchedAt > 60000;
  const data = staleFlow ? undefined : flow.data;
  const trades = data?.trades && now - data.trades.to < 60000 ? data.trades : null;
  const funding = data?.derivatives && now - data.derivatives.time < 120000 ? data.derivatives : null;
  const interest = data?.openInterest && now - data.openInterest.time < 120000 ? data.openInterest : null;
  const total = trades ? trades.buyValue + trades.sellValue : 0;
  const buyShare = trades && total > 0 ? trades.buyValue / total * 100 : null;
  const largeTrades = trades?.largest.filter((row) => row.value >= threshold) ?? [];
  const plan = positionPlan(input);
  const checks = signals ? [
    { name: t("Tren naik", "Uptrend"), ok: signals.trend === "up", detail: "Close > EMA 20 > EMA 50" },
    { name: "Breakout", ok: signals.breakout, detail: t("Close di atas high 20 candle sebelumnya", "Close above the prior 20-bar high") },
    { name: t("Konfirmasi volume", "Volume confirmation"), ok: signals.volumeConfirmed, detail: `RVOL ${number(signals.relativeVolume)}× / ≥ 2×` },
    { name: t("Harga belum terlalu jauh", "Price not extended"), ok: !signals.extended, detail: "RSI < 70; close − EMA 20 ≤ 2 ATR" },
  ] : [];
  const hits = checks.filter((c) => c.ok).length;
  const status = staleCandles ? t("Menunggu data valid", "Waiting for valid data") : signals?.breakdown ? t("Peringatan breakdown", "Breakdown warning") : hits === 4 ? t("Setup breakout terkonfirmasi", "Confirmed breakout setup") : t("Tunggu konfirmasi", "Wait for confirmation");
  const fields: [keyof RiskInput, string][] = [["capital", t("Modal USDT", "Capital USDT")], ["riskPercent", t("Risiko per posisi %", "Risk per position %")], ["entry", "Entry USDT"], ["stop", "Stop USDT"], ["target", "Target USDT"], ["feePercent", t("Fee per sisi %", "Fee per side %")], ["slippagePercent", t("Slippage per sisi %", "Slippage per side %")], ["lotSize", t("Langkah kuantitas (cek bursa)", "Quantity step (check exchange)")]];

  if (!supported) return <section className="desk-panel desk-empty"><h2>Crypto Intel</h2><p>{t("Pilih pasangan crypto USDT, misalnya BTC-USDT. Panel ini khusus Binance spot dan perpetual USDT.", "Choose a crypto USDT pair such as BTC-USDT. This panel covers Binance spot and USDT perpetuals.")}</p></section>;
  return <>
    <section className="desk-panel">
      <div className="desk-panel-head"><div><span className="desk-eyebrow">{symbol} · {timeframe}</span><h2>Crypto Intel</h2></div><button className="desk-button" disabled={flow.isFetching || history.isFetching} onClick={() => { void flow.refetch(); void history.refetch(); }}>{t("Perbarui data", "Refresh data")}</button></div>
      <div className="analysis-toolbar"><TimeframeSelector /><span>Binance · {t("polling 20 detik", "20-second polling")}</span></div>
      <div className="intel-body">
        <p className="desk-muted">{t("Analisis data publik, bukan identifikasi insider. Tidak ada jaminan profit; aturan sinyal belum diuji sebagai strategi yang menguntungkan.", "Public-data analysis, not insider identification. No profit guarantee; signal rules have not been validated as a profitable strategy.")}</p>
        <div className="intel-status" role="status"><strong>{status}</strong><span>{!staleCandles ? `${hits}/4 ${t("kondisi teknikal terpenuhi", "technical conditions met")}` : history.isPending ? t("Mengambil candle…", "Loading candles…") : t("Perlu ≥50 candle selesai, nonsintetis, dan terbaru. Coba interval 1m/5m.", "Needs ≥50 recent, closed, nonsynthetic candles. Try 1m/5m.")}</span></div>
        <div className="intel-checks">{checks.map((c) => <div key={c.name}><strong>{staleCandles ? "?" : c.ok ? "✓" : "·"} {c.name}</strong><span>{c.detail}</span></div>)}</div>
        {signals && <p className="desk-muted">RSI {number(signals.rsi)} · ATR {number(signals.atr, 8)} · {t("Batas breakout", "Breakout level")} {number(signals.priorHigh, 8)} · {t("Batas breakdown", "Breakdown level")} {number(signals.priorLow, 8)}<br />{t("Candle terakhir", "Last candle")}: {new Date(signals.last.closeTime).toLocaleString()}</p>}
        {(flow.isPending || staleFlow || !!flow.data?.unavailable.length) && <p role="status" className="intel-notice">{flow.isPending ? t("Mengambil data bursa…", "Loading exchange data…") : t("Sebagian data tidak tersedia atau sudah basi", "Some data is unavailable or stale")}{flow.data?.unavailable.length ? `: ${flow.data.unavailable.join(", ")}.` : ""} {t("Pasangan yang tidak didukung, batas API, atau pembatasan wilayah dapat membuat data tidak tersedia.", "Unsupported pairs, API limits or regional restrictions may make data unavailable.")}</p>}
        <dl className="intel-metrics">
          <div><dt>Taker buy</dt><dd>{number(buyShare)}%</dd><small>{t("Porsi nilai transaksi agresor beli", "Share of buy-aggressor notional")}</small></div>
          <div><dt>Book imbalance</dt><dd>{number(data?.depth?.imbalance)}%</dd><small>{t("Nilai bid vs ask, 20 level per sisi", "Bid vs ask notional, 20 levels per side")}</small></div>
          <div><dt>Spread spot</dt><dd>{number(data?.depth?.spreadPercent, 8)}%</dd><small>{t("Bid–ask / harga tengah", "Bid–ask / mid price")}</small></div>
          <div><dt>{t("Funding terakhir", "Last funding rate")}</dt><dd>{number(funding?.fundingPercent, 4)}%</dd><small>{funding ? `${t("Berikutnya", "Next")}: ${new Date(funding.nextFundingTime).toLocaleString()}` : t("Perpetual belum tersedia", "Perpetual unavailable")}</small></div>
          <div><dt>Open interest</dt><dd>{number(interest?.quantity)}</dd><small>{t("Unit aset dasar · perpetual", "Base asset units · perpetual")}{interest ? ` · ${new Date(interest.time).toLocaleTimeString()}` : ""}</small></div>
          <div><dt>{t("Nilai bersih taker", "Net taker notional")}</dt><dd>{number(trades ? trades.buyValue - trades.sellValue : null)}</dd><small>USDT · {t("sampel transaksi, bukan aliran wallet", "trade sample, not wallet flows")}</small></div>
        </dl>
        <p className="desk-muted">{t("Funding positif: long membayar short; negatif: sebaliknya. OI tidak menunjukkan arah posisi. Order book bisa dibatalkan dan bukan bukti akumulasi insider.", "Positive funding: longs pay shorts; negative: the reverse. OI does not reveal position direction. Book orders can be cancelled and do not prove insider accumulation.")}</p>
        <p className="desk-muted">{t("Snapshot diterima", "Snapshot received")}: {flow.data ? new Date(flow.data.fetchedAt).toLocaleString() : "—"} · <a href="https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-usd-s-m-futures/api/rest-api/market-data" target="_blank" rel="noreferrer">{t("Dokumentasi sumber", "Source documentation")}</a></p>
      </div>
    </section>
    <section className="desk-panel"><div className="desk-panel-head"><h2>{t("Radar transaksi besar", "Large-trade radar")}</h2></div><div className="intel-body">
      <label className="intel-field">{t("Ambang nilai USDT", "Notional threshold USDT")}<input type="number" min="0" value={threshold} onChange={(e) => setThreshold(Math.max(0, Number(e.target.value)))} /></label>
      <p className="desk-muted">{trades ? `${trades.count} ${t("transaksi agregat terakhir", "latest aggregate trades")} · ${new Date(trades.from).toLocaleTimeString()} – ${new Date(trades.to).toLocaleTimeString()}` : t("Menunggu sampel transaksi terbaru.", "Waiting for a recent trade sample.")} {t("Menampilkan maksimal 10 terbesar dalam sampel. Ini bukan identitas whale atau riwayat lengkap.", "Shows up to the 10 largest in the sample. This is not whale identity or complete history.")}</p>
      {largeTrades.length ? <div className="intel-table-wrap"><table className="intel-table"><thead><tr><th>{t("Waktu", "Time")}</th><th>{t("Agresor", "Aggressor")}</th><th>USDT</th></tr></thead><tbody>{largeTrades.map((row) => <tr key={row.id}><td>{new Date(row.time).toLocaleTimeString()}</td><td>{row.side === "buy" ? t("Beli", "Buy") : t("Jual", "Sell")}</td><td>{number(row.value)}</td></tr>)}</tbody></table></div> : <p role="status">{trades ? t("Tidak ada transaksi melewati ambang dalam sampel ini.", "No trades exceed the threshold in this sample.") : t("Data transaksi tidak tersedia.", "Trade data unavailable.")}</p>}
    </div></section>
    <section className="desk-panel"><div className="desk-panel-head"><h2>{t("Rencana risiko spot / long", "Spot / long risk plan")}</h2><button className="desk-button" disabled={staleCandles || !signals || signals.atr <= 0 || signals.last.close <= signals.atr * 2} onClick={() => { if (signals) setInput((s) => ({ ...s, entry: signals.last.close, stop: signals.last.close - signals.atr * 2, target: signals.last.close + signals.atr * 4 })); }}>{t("Isi skenario 2 ATR", "Fill 2 ATR scenario")}</button></div><div className="intel-body">
      <p>{t("Semua nilai dalam USDT. Skenario ATR hanya titik awal perhitungan, bukan order atau rekomendasi entry.", "All amounts in USDT. The ATR scenario is a calculation starting point, not an order or entry recommendation.")}</p>
      <div className="intel-form">{fields.map(([key, label]) => <label className="intel-field" key={key}>{label}<input type="number" step="any" min="0" value={Number.isNaN(input[key]) ? "" : input[key]} onChange={(e) => setInput((s) => ({ ...s, [key]: e.target.value === "" ? NaN : Number(e.target.value) }))} /></label>)}</div>
      {plan ? <><dl className="intel-metrics"><div><dt>{t("Kuantitas aset", "Asset quantity")}</dt><dd>{number(plan.quantity, 8)}</dd></div><div><dt>{t("Modal terpakai", "Capital used")}</dt><dd>{number(plan.capitalUsed)}</dd></div><div><dt>{t("Rugi pada stop*", "Loss at stop*")}</dt><dd>{number(plan.plannedLoss)}</dd></div><div><dt>{t("Profit pada target*", "Profit at target*")}</dt><dd>{number(plan.plannedProfit)}</dd></div><div><dt>Reward / risk</dt><dd>{number(plan.rewardRisk)}×</dd></div><div><dt>Break-even</dt><dd>{number(plan.breakEven, 8)}</dd></div></dl>{(plan.quantity === 0 || plan.rewardRisk < 2) && <p className="intel-notice">{plan.quantity === 0 ? t("Modal atau anggaran risiko tidak cukup untuk langkah kuantitas ini.", "Capital or risk budget is too small for this quantity step.") : t("Reward/risk bersih di bawah 2×. Periksa biaya dan jarak target.", "Net reward/risk is below 2×. Review costs and target distance.")}</p>}</> : <p role="status">{t("Isi modal positif, risiko 0–100%, serta 0 < stop < entry < target. Fee + slippage harus di bawah 100%.", "Enter positive capital, risk 0–100%, and 0 < stop < entry < target. Fee + slippage must be below 100%.")}</p>}
      <p className="desk-muted">{t("*Termasuk fee dan asumsi slippage pada kedua sisi. Gap dan likuiditas buruk dapat memperbesar kerugian. Tanpa leverage, pajak, funding, dan minimum notional. Periksa langkah kuantitas bursa sebelum transaksi.", "*Includes fees and assumed slippage on both sides. Gaps and poor liquidity may increase losses. Excludes leverage, taxes, funding and minimum notional. Check the exchange quantity step before trading.")}</p>
    </div></section>
  </>;
}
