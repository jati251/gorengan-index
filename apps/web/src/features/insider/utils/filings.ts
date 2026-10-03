import type { SourceState } from "../../../lib/server/publicData";
import { finite } from "../../../lib/server/publicData";
import { tag } from "../../../lib/server/radarParsers";
export interface InsiderFiling {
  accession: string; document: string; cik: string; names: string[]; filedAt: string;
  period: string | null; form: "4" | "4/A"; url: string;
}
export interface FilingsResult { filings: InsiderFiling[]; total: number; totalIsLowerBound: boolean; source: SourceState; offset: number; pageSize: number }
export function parseFilings(text: string) {
  const data = JSON.parse(text);
  if (data.timed_out || !Array.isArray(data.hits?.hits)) throw new Error("SEC search response incomplete");
  const unique = new Map<string, InsiderFiling>();
  for (const hit of data.hits.hits) {
    const row = hit._source;
    if (!row || !["4", "4/A"].includes(row.form) || !/^\d{10}-\d{2}-\d{6}$/.test(row.adsh)) continue;
    const document = String(hit._id ?? "").split(":").slice(1).join(":");
    const cik = String(row.ciks?.[0] ?? "");
    if (!/^\d{1,10}$/.test(cik) || !/^[\w-]+\.xml$/i.test(document) || !/^\d{4}-\d{2}-\d{2}$/.test(row.file_date)) continue;
    unique.set(row.adsh, { accession: row.adsh, document, cik,
      names: Array.isArray(row.display_names) ? row.display_names.filter((n: unknown) => typeof n === "string") : [],
      filedAt: row.file_date, period: /^\d{4}-\d{2}-\d{2}$/.test(row.period_ending) ? row.period_ending : null,
      form: row.form, url: `https://www.sec.gov/Archives/edgar/data/${Number(cik)}/${row.adsh.replaceAll("-", "")}/${document}` });
  }
  return { filings: [...unique.values()].sort((a, b) => b.filedAt.localeCompare(a.filedAt)),
    total: finite(data.hits.total?.value) ?? unique.size, totalIsLowerBound: data.hits.total?.relation === "gte" };
}
export interface OwnershipTransaction {
  date: string; security: string; code: string; direction: string;
  shares: number | null; price: number | null; value: number | null; remaining: number | null;
  ownership: string; derivative: boolean;
  footnoteIds: string[];
}
export function parseOwnershipXml(xml: string) {
  if (!/<ownershipDocument[\s>]/.test(xml) || /<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error("Expected SEC ownership XML");
  const documentType = tag(xml, "documentType");
  if (documentType && !["4", "4/A"].includes(documentType)) throw new Error("Expected a Form 4 or Form 4/A document");
  const issuer = xml.match(/<issuer>([\s\S]*?)<\/issuer>/)?.[1] ?? "";
  const owners = [...xml.matchAll(/<reportingOwner>([\s\S]*?)<\/reportingOwner>/g)].map((m) => ({
    name: tag(m[1], "rptOwnerName"), cik: tag(m[1], "rptOwnerCik"), role: tag(m[1], "officerTitle"),
    director: ["1", "true"].includes(tag(m[1], "isDirector")), officer: ["1", "true"].includes(tag(m[1], "isOfficer")),
  }));
  const transactions: OwnershipTransaction[] = [...xml.matchAll(/<(nonDerivativeTransaction|derivativeTransaction)>([\s\S]*?)<\/\1>/g)].map((m) => {
    const row = m[2], shares = finite(tag(row, "transactionShares")), price = finite(tag(row, "transactionPricePerShare"));
    return { date: tag(row, "transactionDate"), security: tag(row, "securityTitle"), code: tag(row, "transactionCode"),
      direction: tag(row, "transactionAcquiredDisposedCode"), shares, price,
      value: shares !== null && shares >= 0 && price !== null && price >= 0 && Number.isFinite(shares * price) ? shares * price : null,
      remaining: finite(tag(row, "sharesOwnedFollowingTransaction")), ownership: tag(row, "directOrIndirectOwnership"), derivative: m[1] === "derivativeTransaction",
      footnoteIds: [...row.matchAll(/<footnoteId\s+[^>]*id=["']([^"']+)["']/g)].map((ref) => ref[1]) };
  });
  if (!tag(issuer, "issuerCik") || !owners.length) throw new Error("Ownership document missing issuer or reporting owner");
  const plan = tag(xml, "aff10b5One");
  return { issuer: tag(issuer, "issuerName"), ticker: tag(issuer, "issuerTradingSymbol"), issuerCik: tag(issuer, "issuerCik"), owners,
    planned10b51: ["1", "true"].includes(plan) ? true : ["0", "false"].includes(plan) ? false : null, amended: documentType === "4/A", period: tag(xml, "periodOfReport") || null, transactions,
    footnotes: [...xml.matchAll(/<footnote\s[^>]*>([\s\S]*?)<\/footnote>/g)].map((m) => tag(`<value>${m[1]}</value>`, "value")) };
}
export function csvCell(value: unknown) {
  const text = String(value ?? "");
  return `"${(/^[=+\-@\t\r]/.test(text) ? "'" + text : text).replaceAll('"', '""')}"`;
}
export function filingsCsv(filings: InsiderFiling[]) {
  const rows = [["Accession", "Form", "Filed date", "Period", "Reporting names", "Source"], ...filings.map((f) => [f.accession, f.form, f.filedAt, f.period, f.names.join("; "), f.url])];
  return rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
}
