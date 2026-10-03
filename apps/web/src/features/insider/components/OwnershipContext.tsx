"use client";
import { useTranslation } from "@/features/i18n";
import { formatUsd } from "@/features/whale/utils/formatters";
import type { parseOwnershipXml } from "../utils/filings";
import { ownershipContext, positionChange, transactionLabels } from "../utils/context";

export function OwnershipContext({ detail }: { detail: ReturnType<typeof parseOwnershipXml> }) {
  const id = useTranslation().locale === "id";
  const context = ownershipContext(detail);
  return <div className="space-y-3">
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {([['P', context.purchases], ['S', context.sales]] as const).map(([code, summary]) => <div className="border border-zinc-600 rounded p-3" key={code}>
        <strong>{code} · {transactionLabels[code][id ? 'id' : 'en']}</strong>
        <p>{summary.rows} {id ? "baris · nilai terungkap" : "rows · disclosed value"}: {formatUsd(summary.disclosedValue)}</p>
        <p className="text-xs text-zinc-400">{summary.pricedRows}/{summary.rows} {id ? "baris memiliki harga/nilai; bukan nilai bersih portofolio." : "rows have price/value; not net portfolio value."}</p>
      </div>)}
    </div>
    <p>{context.derivativeRows} {id ? "baris derivatif" : "derivative rows"} · {context.otherRows} {id ? "baris award/exercise/lainnya" : "award/exercise/other rows"}</p>
    {context.purchaseReview && <p className="text-amber-300">{id ? "Ada pembelian yang dapat ditinjau lebih lanjut. Checkbox 10b5-1 tidak dicentang; periksa footnote sebelum menyimpulkan transaksi tidak terencana." : "Purchase rows merit further review. The 10b5-1 checkbox is not checked; read footnotes before concluding these were unplanned."}</p>}
    {detail.planned10b51 && <p>{id ? "Checkbox 10b5-1 dicentang untuk filing ini. Jangan otomatis menganggap semua baris transaksi sebagai discretionary." : "The filing's 10b5-1 checkbox is checked. Do not automatically treat every transaction row as discretionary."}</p>}
    {context.review && <p className="text-amber-300">{id ? "Perlu tinjauan manual: amendemen, pemilik bersama, atau footnote. Nilai adalah baris dokumen ini; jangan jumlahkan dengan filing asli tanpa rekonsiliasi." : "Manual review needed for amendments, joint owners or footnotes. Values describe this document's rows; reconcile originals before aggregation."}</p>}
    <div className="overflow-x-auto rounded-lg border border-zinc-700/80 bg-zinc-950/60">
      <table className="w-full min-w-[720px] text-left text-xs">
        <thead>
          <tr className="border-b border-zinc-800 bg-zinc-900/80">
            {[id ? "Tanggal" : "Date", id ? "Jenis transaksi" : "Transaction", id ? "Efek" : "Security", "A/D", id ? "Jumlah" : "Shares", id ? "Harga" : "Price", id ? "Nilai" : "Value", "D/I", id ? "Perubahan posisi baris" : "Row position change"].map((h) => (
              <th className="p-2.5 font-mono text-[11px] text-zinc-300 whitespace-nowrap" key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800/80">
          {detail.transactions.map((tx, i) => {
            const change = positionChange(tx);
            return (
              <tr key={i} className="hover:bg-zinc-900/30 transition-colors">
                <td className="p-2.5 whitespace-nowrap font-mono text-zinc-300">{tx.date}</td>
                <td className="p-2.5 min-w-36">
                  <span className="font-semibold text-zinc-200">{tx.code} · {transactionLabels[tx.code]?.[id ? 'id' : 'en'] ?? (id ? 'Lihat instruksi SEC' : 'See SEC instructions')}</span>
                  {tx.derivative && <span className="text-amber-400 font-mono text-[10px] ml-1">({id ? "derivatif" : "derivative"})</span>}
                  {tx.footnoteIds.length > 0 && <p className="text-[10px] text-zinc-400 mt-0.5">Footnotes: {tx.footnoteIds.join(', ')}</p>}
                </td>
                <td className="p-2.5 text-zinc-300">{tx.security}</td>
                <td className="p-2.5 font-mono">{tx.direction}</td>
                <td className="p-2.5 font-mono tabular-nums">{tx.shares?.toLocaleString() ?? "—"}</td>
                <td className="p-2.5 font-mono tabular-nums">{formatUsd(tx.price)}</td>
                <td className="p-2.5 font-mono tabular-nums font-semibold text-zinc-100">{formatUsd(tx.value)}</td>
                <td className="p-2.5 font-mono">{tx.ownership}</td>
                <td className="p-2.5 whitespace-nowrap font-mono">
                  {change.newPosition
                    ? (id ? 'Dari nol pada baris ini' : 'From zero on this row')
                    : change.percent === null
                      ? '—'
                      : <span className={change.percent > 0 ? "text-emerald-400" : change.percent < 0 ? "text-rose-400" : ""}>{`${change.percent > 0 ? '+' : ''}${change.percent.toFixed(1)}%`}</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
    <p className="text-xs text-zinc-400">{id ? "Persentase dihitung dari jumlah transaksi dan saham tersisa pada satu baris kepemilikan langsung. Ini bukan persentase portofolio atau bukti pembelian pertama sepanjang riwayat. Baris ber-footnote dan derivatif tidak dihitung." : "Percentages use transaction shares and remaining shares for one direct-ownership row. This is not a portfolio percentage or proof of a first-ever purchase. Footnoted and derivative rows are excluded."}</p>
  </div>;
}
