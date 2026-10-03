import { parseOwnershipXml, type InsiderFiling, type OwnershipTransaction } from "./filings";

export const transactionLabels: Record<string, { en: string; id: string }> = {
  P: { en: "Market / private purchase", id: "Pembelian pasar / privat" },
  S: { en: "Market / private sale", id: "Penjualan pasar / privat" },
  A: { en: "Grant / award / company acquisition", id: "Hibah / award / akuisisi dari perusahaan" },
  M: { en: "Exercise / conversion", id: "Exercise / konversi" },
  F: { en: "Exercise payment / tax withholding", id: "Pembayaran exercise / pemotongan pajak" },
  G: { en: "Gift", id: "Hibah" },
  D: { en: "Disposition to issuer", id: "Penyerahan kepada emiten" },
  K: { en: "Equity swap / hedge", id: "Swap saham / lindung nilai" },
  J: { en: "Other · read footnotes", id: "Lainnya · baca footnote" },
  C: { en: "Conversion", id: "Konversi" },
};

export function positionChange(tx: OwnershipTransaction): { percent: number | null; newPosition: boolean } {
  const unknown = { percent: null, newPosition: false };
  // The calculation describes one directly held security/account row, never a portfolio.
  if (tx.derivative || tx.ownership !== "D" || tx.footnoteIds.length || !["P", "S"].includes(tx.code)
    || tx.shares === null || tx.shares <= 0 || tx.remaining === null || tx.remaining < 0
    || (tx.code === "P" ? tx.direction !== "A" : tx.direction !== "D")) return unknown;
  const before = tx.direction === "A" ? tx.remaining - tx.shares : tx.remaining + tx.shares;
  if (!Number.isFinite(before) || before < 0) return unknown;
  if (before === 0) return { percent: null, newPosition: tx.direction === "A" };
  const percent = (tx.direction === "A" ? 1 : -1) * tx.shares / before * 100;
  return Number.isFinite(percent) ? { percent, newPosition: false } : unknown;
}

export function ownershipContext(detail: ReturnType<typeof parseOwnershipXml>) {
  const purchases = detail.transactions.filter((tx) => !tx.derivative && tx.code === "P" && tx.direction === "A");
  const sales = detail.transactions.filter((tx) => !tx.derivative && tx.code === "S" && tx.direction === "D");
  const total = (rows: OwnershipTransaction[]) => ({
    rows: rows.length, pricedRows: rows.filter((tx) => tx.value !== null).length,
    disclosedValue: rows.some((tx) => tx.value !== null) ? rows.reduce((sum, tx) => sum + (tx.value ?? 0), 0) : null,
  });
  return {
    purchases: total(purchases), sales: total(sales),
    derivativeRows: detail.transactions.filter((tx) => tx.derivative).length,
    otherRows: detail.transactions.length - purchases.length - sales.length - detail.transactions.filter((tx) => tx.derivative).length,
    review: detail.amended || detail.owners.length > 1 || detail.footnotes.length > 0,
    purchaseReview: purchases.length > 0 && detail.planned10b51 === false && !detail.amended,
  };
}

export function filingContext(filing: InsiderFiling) {
  const filed = Date.parse(`${filing.filedAt}T00:00:00Z`), period = Date.parse(`${filing.period}T00:00:00Z`);
  const gap = (filed - period) / 86400000;
  return { periodGapDays: Number.isInteger(gap) && gap >= 0 ? gap : null, amended: filing.form === "4/A" };
}

export function importFilingXml(xml: string, filing: InsiderFiling) {
  const detail = parseOwnershipXml(xml);
  const identifiers = filing.names.flatMap((name) => [...name.matchAll(/CIK\s+(\d+)/g)].map((m) => Number(m[1])));
  if (!identifiers.includes(Number(detail.issuerCik))) throw new Error("XML issuer CIK does not match this filing.");
  if (detail.amended !== (filing.form === "4/A")) throw new Error("XML amendment type does not match.");
  if (filing.period && detail.period !== filing.period) throw new Error("XML report period does not match this filing.");
  return detail;
}
