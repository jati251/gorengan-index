"use client";

import { useTranslation } from "@/features/i18n";

export function DataState({ loading = false, error = false, onRetry }: { loading?: boolean; error?: boolean; onRetry?: () => void }) {
  const { locale } = useTranslation();
  const id = locale === "id";
  return <div className="data-state" role="status" aria-busy={loading}>
    {loading && <div className="data-state-blocks" aria-hidden="true"><i /><i /><i /></div>}
    <strong>{loading ? (id ? "Memuat data…" : "Loading data…") : error ? (id ? "Data belum bisa dimuat" : "Unable to load data") : (id ? "Belum ada data" : "No data yet")}</strong>
    <p>{loading ? (id ? "Menghubungkan ke sumber data." : "Connecting to the data source.") : error ? (id ? "Periksa koneksi lalu coba lagi." : "Check your connection and try again.") : (id ? "Data akan muncul setelah tersedia dari penyedia." : "Data will appear when available from the provider.")}</p>
    {!loading && onRetry && <button type="button" onClick={onRetry}>{id ? "Coba lagi" : "Try again"}</button>}
  </div>;
}
