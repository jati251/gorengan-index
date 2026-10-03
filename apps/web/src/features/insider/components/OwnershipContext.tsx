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
    <div className="overflow-auto"><table className="w-full text-left text-xs"><thead><tr>{[id ? "Tanggal" : "Date", id ? "Jenis transaksi" : "Transaction", id ? "Efek" : "Security", "A/D", id ? "Jumlah" : "Shares", id ? "Harga" : "Price", id ? "Nilai" : "Value", "D/I", id ? "Perubahan posisi baris" : "Row position change"].map((h) => <th className="p-2" key={h}>{h}</th>)}</tr></thead><tbody>{detail.transactions.map((tx, i) => {
      const change = positionChange(tx);
      return <tr key={i} className="border-t border-zinc-700"><td className="p-2 whitespace-nowrap">{tx.date}</td><td className="p-2 min-w-36">{tx.code} · {transactionLabels[tx.code]?.[id ? 'id' : 'en'] ?? (id ? 'Lihat instruksi SEC' : 'See SEC instructions')}{tx.derivative ? (id ? " · derivatif" : " · derivative") : ""}{tx.footnoteIds.length > 0 && <p>{id ? "Footnote" : "Footnotes"}: {tx.footnoteIds.join(', ')}</p>}</td><td>{tx.security}</td><td>{tx.direction}</td><td>{tx.shares?.toLocaleString() ?? "—"}</td><td>{formatUsd(tx.price)}</td><td>{formatUsd(tx.value)}</td><td>{tx.ownership}</td><td className="p-2 whitespace-nowrap">{change.newPosition ? (id ? 'Dari nol pada baris ini' : 'From zero on this row') : change.percent === null ? '—' : `${change.percent > 0 ? '+' : ''}${change.percent.toFixed(1)}%`}</td></tr>;
    })}</tbody></table></div>
    <p className="text-xs text-zinc-400">{id ? "Persentase dihitung dari jumlah transaksi dan saham tersisa pada satu baris kepemilikan langsung. Ini bukan persentase portofolio atau bukti pembelian pertama sepanjang riwayat. Baris ber-footnote dan derivatif tidak dihitung." : "Percentages use transaction shares and remaining shares for one direct-ownership row. This is not a portfolio percentage or proof of a first-ever purchase. Footnoted and derivative rows are excluded."}</p>
  </div>;
}
