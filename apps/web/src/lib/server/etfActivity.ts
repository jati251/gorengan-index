import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { publicData, finite, type SourceState } from "./publicData";
import { decodeXml } from "./radarParsers";

export const FLOW_URL = "https://farside.co.uk/bitcoin-etf-flow-all-data/";
export const HISTORY_URL = "https://xoomar.com/api/markets/etf-flows?asset=btc&days=180";
export const ISSUER_URL = "https://www.ishares.com/us/products/333011/ishares-bitcoin-trust-etf/latest-holdings.csv";
export interface HoldingSnapshot { date: string; btcHeld: number; sourceUrl: string; observedAt: number }
export interface EtfActivityRow {
  date: string; btcHeld: number | null; previousHoldingsDate: string | null; holdingsChangeBtc: number | null;
  netFlowUsd: number | null; estimatedHoldingsChangeUsd: number | null; holdingsSourceUrl: string | null;
}
export interface EtfActivity {
  rows: EtfActivityRow[]; sources: SourceState[]; persistenceError: string | null;
  walletTracking: "unavailable";
}
const validDate = (date: unknown): date is string => typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date)
  && Number.isFinite(Date.parse(date)) && new Date(date).toISOString().slice(0, 10) === date
  && date >= "2024-01-05" && date <= new Date().toISOString().slice(0, 10);

export function parseHoldingHistory(raw: string) {
  const payload = JSON.parse(raw);
  if (!Array.isArray(payload.data)) throw new Error("Missing holdings history");
  const rows = new Map<string, { date: string; btcHeld: number; estimatedHoldingsChangeUsd: number | null }>();
  for (const item of payload.data) {
    if (item.ticker !== "IBIT" || item.asset !== "btc") continue;
    const btcHeld = finite(item.holdings), usd = finite(item.flowUsd);
    if (!validDate(item.date) || btcHeld === null || btcHeld <= 0 || btcHeld > 21_000_000
      || (item.flowUsd != null && usd === null)) throw new Error("Invalid IBIT holdings history row");
    if (rows.has(item.date)) throw new Error("Duplicate IBIT holdings date");
    rows.set(item.date, { date: item.date, btcHeld, estimatedHoldingsChangeUsd: usd });
  }
  if (!rows.size) throw new Error("No IBIT history published");
  return [...rows.values()].sort((a, b) => a.date.localeCompare(b.date));
}
export function parseReportedFlows(html: string) {
  const flows = new Map<string, number | null>();
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  let ibitIndex = -1;
  for (const tr of html.match(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi) ?? []) {
    const cells = [...tr.matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((m) => decodeXml(m[1]).replace(/\u00a0|&nbsp;/g, " ").trim());
    if (cells.includes("IBIT")) { ibitIndex = cells.indexOf("IBIT"); continue; }
    if (ibitIndex < 1) continue;
    const match = cells[0]?.match(/^(\d{1,2}) ([A-Z][a-z]{2}) (\d{4})$/);
    if (!match) continue;
    const month = months.indexOf(match[2]);
    const date = `${match[3]}-${String(month + 1).padStart(2, "0")}-${match[1].padStart(2, "0")}`;
    if (month < 0 || !validDate(date)) throw new Error("Invalid flow date");
    const value = cells[ibitIndex];
    if (value === undefined) throw new Error("Missing IBIT flow cell");
    let usd: number | null = null;
    if (value !== "-" && value !== "—" && value !== "") {
      if (!/^(?:-?\d[\d,]*(?:\.\d+)?|\(\d[\d,]*(?:\.\d+)?\))$/.test(value ?? "")) throw new Error("Invalid flow amount");
      usd = Number(value.replace(/[(),]/g, "")) * (value.startsWith("(") ? -1 : 1) * 1_000_000;
      if (!Number.isFinite(usd)) throw new Error("Invalid flow amount");
    }
    if (flows.has(date)) throw new Error("Duplicate reported flow date");
    flows.set(date, usd);
  }
  if (!flows.size) throw new Error("Reported flow table unavailable");
  return [...flows].map(([date, netFlowUsd]) => ({ date, netFlowUsd }));
}
export function activityRows(snapshots: HoldingSnapshot[], estimates: ReturnType<typeof parseHoldingHistory>, flows: ReturnType<typeof parseReportedFlows>): EtfActivityRow[] {
  const holdings = new Map(snapshots.map((s) => [s.date, s]));
  const previous = new Map<string, HoldingSnapshot>();
  const sorted = [...holdings.values()].sort((a, b) => a.date.localeCompare(b.date));
  sorted.forEach((s, i) => { if (i) previous.set(s.date, sorted[i - 1]); });
  const estimatesByDate = new Map(estimates.map((e) => [e.date, e]));
  const flowByDate = new Map(flows.map((f) => [f.date, f.netFlowUsd]));
  const estimatePrevious = new Map(estimates.map((e, i) => [e.date, estimates[i - 1]]));
  return [...new Set([...holdings.keys(), ...flowByDate.keys()])].sort().reverse().map((date) => {
    const s = holdings.get(date), p = previous.get(date), estimate = estimatesByDate.get(date);
    return { date, btcHeld: s?.btcHeld ?? null, previousHoldingsDate: p?.date ?? null,
      holdingsChangeBtc: s && p ? s.btcHeld - p.btcHeld : null, netFlowUsd: flowByDate.get(date) ?? null,
      estimatedHoldingsChangeUsd: s && p && estimate && estimatePrevious.get(date)?.date === p.date
        && Math.abs(estimatePrevious.get(date)!.btcHeld - p.btcHeld) < 0.000001 && Math.abs(estimate.btcHeld - s.btcHeld) < 0.000001 ? estimate.estimatedHoldingsChangeUsd : null,
      holdingsSourceUrl: s?.sourceUrl ?? null };
  });
}

// One atomic local archive per process; use a persistent volume for restart durability.
let archiveQueue: Promise<unknown> = Promise.resolve();
export function archiveSnapshots(incoming: HoldingSnapshot[], directory = process.env.IBIT_HISTORY_DIR ?? join(process.cwd(), ".data", "ibit")) {
  const task = archiveQueue.then(async () => {
    const file = join(directory, "holdings.json");
    let stored: HoldingSnapshot[] = [];
    try {
      const parsed = JSON.parse(await readFile(file, "utf8"));
      if (!Array.isArray(parsed) || !parsed.every((s) => validDate(s.date) && Number.isFinite(s.btcHeld) && s.btcHeld > 0 && s.btcHeld <= 21_000_000
        && [ISSUER_URL, HISTORY_URL].includes(s.sourceUrl) && Number.isFinite(s.observedAt))) throw new Error("Invalid local holdings archive");
      stored = parsed;
    } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
    const merged = new Map(stored.map((s) => [s.date, s]));
    for (const s of incoming) {
      const existing = merged.get(s.date);
      if (!existing || ((s.sourceUrl === ISSUER_URL || existing.sourceUrl !== ISSUER_URL)
        && (s.btcHeld !== existing.btcHeld || s.sourceUrl !== existing.sourceUrl))) merged.set(s.date, s);
    }
    const result = [...merged.values()].sort((a, b) => a.date.localeCompare(b.date)).slice(-2000);
    if (JSON.stringify(result) !== JSON.stringify(stored)) {
      await mkdir(directory, { recursive: true });
      const temp = `${file}.${process.pid}.tmp`;
      await writeFile(temp, JSON.stringify(result));
      await rename(temp, file);
    }
    return result;
  });
  archiveQueue = task.catch(() => {});
  return task;
}
export async function getEtfActivity(official: { asOf: string; btcHeld: number } | null): Promise<EtfActivity> {
  const [history, flows] = await Promise.all([
    publicData.read(HISTORY_URL, { source: "XOOMAR · issuer holdings archive / derived USD change", timeoutMs: 20_000, ttlMs: 3_600_000, failureRetryMs: 60_000, maxStaleMs: 86_400_000, parse: parseHoldingHistory }),
    publicData.read(FLOW_URL, { source: "Farside · reported ETF net flow", ttlMs: 3_600_000, failureRetryMs: 3_600_000, maxStaleMs: 86_400_000, parse: parseReportedFlows }),
  ]);
  const incoming: HoldingSnapshot[] = (history.data ?? []).map((s) => ({ date: s.date, btcHeld: s.btcHeld, sourceUrl: HISTORY_URL, observedAt: history.fetchedAt! }));
  if (official) incoming.push({ date: official.asOf, btcHeld: official.btcHeld, sourceUrl: ISSUER_URL, observedAt: Date.now() });
  let snapshots = incoming, persistenceError: string | null = null;
  try { snapshots = await archiveSnapshots(incoming); } catch (error) { persistenceError = error instanceof Error ? error.message : "Local archive unavailable"; }
  return { rows: activityRows(snapshots, history.data ?? [], flows.data ?? []), sources: [history, flows].map(({ data: _data, ...state }) => state), persistenceError, walletTracking: "unavailable" };
}
