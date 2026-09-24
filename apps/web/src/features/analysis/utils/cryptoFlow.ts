export interface CryptoFlow {
  symbol: string;
  fetchedAt: number;
  depth: { bidValue: number; askValue: number; imbalance: number; spreadPercent: number } | null;
  trades: { count: number; from: number; to: number; buyValue: number; sellValue: number; largest: { id: number; time: number; value: number; side: "buy" | "sell" }[] } | null;
  derivatives: { fundingPercent: number; nextFundingTime: number; markPrice: number; time: number } | null;
  openInterest: { quantity: number; time: number } | null;
  unavailable: string[];
}

function numeric(value: unknown): number {
  if ((typeof value !== "string" && typeof value !== "number") || value === "") throw new Error("Invalid number");
  const n = Number(value);
  if (!Number.isFinite(n)) throw new Error("Invalid number");
  return n;
}
function positive(value: unknown) { const n = numeric(value); if (n <= 0) throw new Error("Invalid positive number"); return n; }
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid record");
  return value as Record<string, unknown>;
}
export function parseDepth(value: unknown): NonNullable<CryptoFlow["depth"]> {
  const data = record(value);
  const levels = (raw: unknown) => {
    if (!Array.isArray(raw) || raw.length === 0) throw new Error("Missing depth");
    return raw.map((row) => { if (!Array.isArray(row)) throw new Error("Invalid level"); return [positive(row[0]), positive(row[1])] as const; });
  };
  const bids = levels(data.bids), asks = levels(data.asks);
  const bid = Math.max(...bids.map(([p]) => p)), ask = Math.min(...asks.map(([p]) => p));
  if (ask < bid) throw new Error("Crossed book");
  const bidValue = bids.reduce((sum, [p, q]) => sum + p * q, 0);
  const askValue = asks.reduce((sum, [p, q]) => sum + p * q, 0);
  if (!Number.isFinite(bidValue + askValue)) throw new Error("Depth overflow");
  return { bidValue, askValue, imbalance: (bidValue - askValue) / (bidValue + askValue) * 100, spreadPercent: (ask - bid) / ((ask + bid) / 2) * 100 };
}
export function parseTrades(value: unknown): NonNullable<CryptoFlow["trades"]> {
  if (!Array.isArray(value) || !value.length) throw new Error("Missing trades");
  const unique = new Map<number, { id: number; time: number; value: number; side: "buy" | "sell" }>();
  for (const item of value) {
    const row = record(item);
    if (typeof row.m !== "boolean") throw new Error("Missing taker side");
    const trade = { id: numeric(row.a), time: positive(row.T), value: positive(row.p) * positive(row.q), side: row.m ? "sell" as const : "buy" as const };
    if (!Number.isFinite(trade.value)) throw new Error("Trade overflow");
    unique.set(trade.id, trade);
  }
  const rows = [...unique.values()].sort((a, b) => a.time - b.time);
  return { count: rows.length, from: rows[0].time, to: rows[rows.length - 1].time,
    buyValue: rows.filter((r) => r.side === "buy").reduce((sum, r) => sum + r.value, 0),
    sellValue: rows.filter((r) => r.side === "sell").reduce((sum, r) => sum + r.value, 0),
    largest: rows.sort((a, b) => b.value - a.value).slice(0, 10) };
}
export function parseFunding(value: unknown, symbol: string): NonNullable<CryptoFlow["derivatives"]> {
  const row = record(value);
  if (row.symbol !== symbol) throw new Error("Wrong symbol");
  return { fundingPercent: numeric(row.lastFundingRate) * 100, nextFundingTime: positive(row.nextFundingTime), markPrice: positive(row.markPrice), time: positive(row.time) };
}
export function parseOpenInterest(value: unknown, symbol: string): NonNullable<CryptoFlow["openInterest"]> {
  const row = record(value);
  if (row.symbol !== symbol) throw new Error("Wrong symbol");
  const quantity = numeric(row.openInterest);
  if (quantity < 0) throw new Error("Invalid open interest");
  return { quantity, time: positive(row.time) };
}
