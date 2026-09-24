"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRightLeft, Calculator, RefreshCw } from "lucide-react";
import { useTranslation } from "@/features/i18n";
import { calculateTrade } from "../utils/calculator";

interface ExchangeRate { rate: number; date: string; fetchedAt: string; source: string }

export function useExchangeRate() {
  return useQuery<ExchangeRate>({
    queryKey: ["usd-idr"],
    queryFn: async () => {
      const response = await fetch("/api/exchange-rate");
      if (!response.ok) throw new Error("Exchange rate unavailable");
      return response.json();
    },
    staleTime: 300_000,
    refetchInterval: 300_000,
    retry: 1,
  });
}

export function ExchangeRateReference({ onOpen }: { onOpen: () => void }) {
  const { data, isError } = useExchangeRate();
  return <button type="button" className="desk-button exchange-reference" onClick={onOpen}><ArrowRightLeft size={14} /><span>USD/IDR</span><b>{data ? `${isError ? "~ " : ""}${data.rate.toLocaleString("id-ID")}` : "—"}</b></button>;
}

export function CalculatorPanel() {
  const { locale } = useTranslation();
  const id = locale === "id";
  const fx = useExchangeRate();
  const [direction, setDirection] = useState<"USD" | "IDR">("USD");
  const [amount, setAmount] = useState("100");
  const [currency, setCurrency] = useState<"USD" | "IDR">("USD");
  const [capital, setCapital] = useState("");
  const [entry, setEntry] = useState("");
  const [exit, setExit] = useState("");
  const [fee, setFee] = useState("0");
  const format = (value: number, unit: string) => new Intl.NumberFormat(id ? "id-ID" : "en-US", { style: "currency", currency: unit, maximumFractionDigits: unit === "IDR" ? 0 : 4 }).format(value);
  const parsedAmount = Number(amount);
  const converted = fx.data && amount.trim() && Number.isFinite(parsedAmount) && parsedAmount >= 0 ? direction === "USD" ? parsedAmount * fx.data.rate : parsedAmount / fx.data.rate : null;
  const trade = capital.trim() && entry.trim() && exit.trim() && fee.trim() ? calculateTrade(Number(capital), Number(entry), Number(exit), Number(fee)) : null;
  const stale = fx.data && (fx.dataUpdatedAt - Date.parse(fx.data.date) > 4 * 86_400_000 || fx.isError);
  return <div className="calculator-workspace">
    <section className="desk-panel">
      <div className="desk-panel-head"><div><span className="desk-eyebrow">USD ↔ IDR</span><h2>{id ? "Konversi mata uang" : "Currency converter"}</h2></div><button className="desk-icon-button" type="button" aria-label={id ? "Perbarui kurs" : "Refresh exchange rate"} disabled={fx.isFetching} onClick={() => fx.refetch()}><RefreshCw size={16} className={fx.isFetching ? "desk-spin" : ""} /></button></div>
      <div className="desk-panel-body">
        <div className="desk-segment"><button type="button" aria-pressed={direction === "USD"} onClick={() => setDirection("USD")}>USD → IDR</button><button type="button" aria-pressed={direction === "IDR"} onClick={() => setDirection("IDR")}>IDR → USD</button></div>
        <label className="calculator-field">{id ? "Jumlah" : "Amount"} ({direction})<input type="number" min="0" step="any" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} /></label>
        <output className="conversion-result" aria-live="polite">{converted !== null && Number.isFinite(converted) ? format(converted, direction === "USD" ? "IDR" : "USD") : "—"}</output>
        {fx.data ? <div className="exchange-source"><strong>1 USD = {format(fx.data.rate, "IDR")}</strong><p>{id ? "Kurs acuan tanggal" : "Reference rate dated"} {fx.data.date} · <a href="https://frankfurter.dev/" target="_blank" rel="noreferrer">Frankfurter ↗</a></p><p>{id ? "Diambil" : "Fetched"}: {new Date(fx.data.fetchedAt).toLocaleString(id ? "id-ID" : "en-US")}</p><p>{id ? "Kurs harian; nilai transaksi bank/exchange dapat berbeda. USDT tidak otomatis dianggap USD." : "Daily reference; bank/exchange execution rates may differ. USDT is not automatically treated as USD."}</p></div> : <p role="status">{fx.isError ? (id ? "Kurs belum tersedia. Coba perbarui." : "Rate unavailable. Try refreshing.") : (id ? "Memuat kurs terbaru…" : "Loading latest rate…")}</p>}
        {stale && <p className="desk-data-note" role="status">{id ? "Kurs tersimpan ditampilkan; pembaruan terbaru belum tersedia." : "Showing a stored rate; a newer update is unavailable."}</p>}
      </div>
    </section>
    <section className="desk-panel">
      <div className="desk-panel-head"><div><span className="desk-eyebrow">{id ? "Simulasi spot / long" : "Spot / long simulation"}</span><h2>{id ? "Kalkulator untung & rugi" : "Profit & loss calculator"}</h2></div><Calculator size={20} /></div>
      <div className="desk-panel-body">
        <label className="calculator-field">{id ? "Mata uang input" : "Input currency"}<select value={currency} onChange={(event) => setCurrency(event.target.value as "USD" | "IDR")}><option value="USD">USD</option><option value="IDR">IDR</option></select></label>
        <div className="calculator-inputs">{[
          { label: id ? "Modal termasuk fee beli" : "Capital including buy fee", value: capital, set: setCapital, unit: currency },
          { label: id ? "Harga beli per unit" : "Entry price per unit", value: entry, set: setEntry, unit: currency },
          { label: id ? "Harga jual per unit" : "Exit price per unit", value: exit, set: setExit, unit: currency },
          { label: id ? "Fee tiap transaksi" : "Fee per transaction", value: fee, set: setFee, unit: "%" },
        ].map((field) => <label className="calculator-field" key={field.label}>{field.label} ({field.unit})<input type="number" min="0" max={field.unit === "%" ? "99.99" : undefined} step="any" inputMode="decimal" placeholder="0" value={field.value} onChange={(event) => field.set(event.target.value)} /></label>)}</div>
        <p className="desk-muted">{id ? "Semua harga memakai mata uang input. Mengganti pilihan hanya mengganti satuan; gunakan konverter untuk menghitung nilainya." : "All prices use the input currency. Changing it changes units only; use the converter to calculate equivalent values."}</p>
        {trade ? <div aria-live="polite"><div className="calculator-profit"><span>{id ? "Estimasi laba/rugi bersih" : "Estimated net profit/loss"}</span><strong className={trade.profit >= 0 ? "desk-positive" : "desk-negative"}>{format(trade.profit, currency)}</strong><span>{trade.roi.toFixed(2)}% ROI</span>{fx.data && <span>≈ {format(currency === "USD" ? trade.profit * fx.data.rate : trade.profit / fx.data.rate, currency === "USD" ? "IDR" : "USD")} · {fx.data.date}</span>}</div><dl className="calculator-results">{[
          [id ? "Jumlah unit" : "Units", trade.quantity.toLocaleString(id ? "id-ID" : "en-US", { maximumSignificantDigits: 10 })],
          [id ? "Total fee beli + jual" : "Total buy + sell fees", format(trade.fees, currency)],
          [id ? "Hasil jual bersih" : "Net sale proceeds", format(trade.proceeds, currency)],
          [id ? "Harga impas per unit" : "Break-even price per unit", format(trade.breakEven, currency)],
        ].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></div> : <p className="desk-data-note">{id ? "Isi modal dan harga beli > 0, harga jual ≥ 0, serta fee 0–<100%." : "Enter capital and entry price > 0, exit price ≥ 0, and a fee from 0 to <100%."}</p>}
      </div>
      <p className="analysis-footnote">{id ? "Unit pecahan diizinkan. Belum memperhitungkan lot minimum, pajak, spread, slippage, leverage, atau funding. Fee yang sama dikenakan saat beli dan jual." : "Fractional units allowed. Excludes minimum lots, taxes, spread, slippage, leverage and funding. The same fee applies to buying and selling."}</p>
    </section>
  </div>;
}
