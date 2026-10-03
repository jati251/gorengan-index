export interface CryptoWall {
  price: number;
  value: number;
  distancePercent: number;
}

export interface CryptoFlow {
  symbol: string;
  fetchedAt: number;
  sources?: import("../../../lib/server/publicData").SourceState[];
  depth: {
    bidValue: number;
    askValue: number;
    imbalance: number;
    spreadPercent: number;
    top5Imbalance: number;
    depthRatio: number;
    bidWall: CryptoWall | null;
    askWall: CryptoWall | null;
  } | null;
  trades: {
    count: number;
    firstPrice: number;
    lastPrice: number;
    megaCount: number;
    megaBuyValue: number;
    megaSellValue: number;
    from: number;
    to: number;
    buyValue: number;
    sellValue: number;
    cvd: number;
    buyRatio: number;
    whaleTradesCount: number;
    whaleBuyValue: number;
    whaleSellValue: number;
    whaleNetValue: number;
    largest: { id: number; time: number; value: number; side: "buy" | "sell" }[];
  } | null;
  derivatives: {
    fundingPercent: number;
    annualizedFundingPercent: number | null;
    nextFundingTime: number;
    markPrice: number;
    time: number;
    fundingBias: "EXTREME_LONG" | "LONG_BIAS" | "NEUTRAL" | "SHORT_BIAS" | "EXTREME_SHORT";
  } | null;
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
  const bids = levels(data.bids).sort((a, b) => b[0] - a[0]), asks = levels(data.asks).sort((a, b) => a[0] - b[0]);
  const bid = Math.max(...bids.map(([p]) => p)), ask = Math.min(...asks.map(([p]) => p));
  if (ask < bid) throw new Error("Crossed book");
  const bidValue = bids.reduce((sum, [p, q]) => sum + p * q, 0);
  const askValue = asks.reduce((sum, [p, q]) => sum + p * q, 0);
  if (!Number.isFinite(bidValue + askValue)) throw new Error("Depth overflow");

  const mid = (bid + ask) / 2;

  // Top 5 depth imbalance
  const top5Bids = bids.slice(0, 5);
  const top5Asks = asks.slice(0, 5);
  const top5BidVal = top5Bids.reduce((sum, [p, q]) => sum + p * q, 0);
  const top5AskVal = top5Asks.reduce((sum, [p, q]) => sum + p * q, 0);
  const top5Imbalance = top5BidVal + top5AskVal > 0 ? ((top5BidVal - top5AskVal) / (top5BidVal + top5AskVal)) * 100 : 0;

  // Detect largest limit order walls
  let maxBidLevel = bids[0];
  let maxBidNotional = bids[0][0] * bids[0][1];
  for (const [p, q] of bids) {
    const notional = p * q;
    if (notional > maxBidNotional) {
      maxBidNotional = notional;
      maxBidLevel = [p, q];
    }
  }

  let maxAskLevel = asks[0];
  let maxAskNotional = asks[0][0] * asks[0][1];
  for (const [p, q] of asks) {
    const notional = p * q;
    if (notional > maxAskNotional) {
      maxAskNotional = notional;
      maxAskLevel = [p, q];
    }
  }

  const bidWall: CryptoWall | null = maxBidNotional > 0 ? {
    price: maxBidLevel[0],
    value: maxBidNotional,
    distancePercent: ((mid - maxBidLevel[0]) / mid) * 100,
  } : null;

  const askWall: CryptoWall | null = maxAskNotional > 0 ? {
    price: maxAskLevel[0],
    value: maxAskNotional,
    distancePercent: ((maxAskLevel[0] - mid) / mid) * 100,
  } : null;

  const depthRatio = askValue > 0 ? bidValue / askValue : 1;

  return {
    bidValue,
    askValue,
    imbalance: (bidValue - askValue) / (bidValue + askValue) * 100,
    spreadPercent: (ask - bid) / mid * 100,
    top5Imbalance,
    depthRatio,
    bidWall,
    askWall,
  };
}
export function parseTrades(value: unknown): NonNullable<CryptoFlow["trades"]> {
  if (!Array.isArray(value) || !value.length) throw new Error("Missing trades");
  const unique = new Map<number, { id: number; time: number; price: number; value: number; side: "buy" | "sell" }>();
  for (const item of value) {
    const row = record(item);
    if (typeof row.m !== "boolean") throw new Error("Missing taker side");
    if (!Number.isSafeInteger(numeric(row.a)) || numeric(row.a) < 0) throw new Error("Invalid trade ID");
    const trade = { price: positive(row.p), id: numeric(row.a), time: positive(row.T), value: positive(row.p) * positive(row.q), side: row.m ? "sell" as const : "buy" as const };
    if (!Number.isFinite(trade.value)) throw new Error("Trade overflow");
    unique.set(trade.id, trade);
  }
  const rows = [...unique.values()].sort((a, b) => a.time - b.time);
  const buyTrades = rows.filter((r) => r.side === "buy");
  const sellTrades = rows.filter((r) => r.side === "sell");
  const buyValue = buyTrades.reduce((sum, r) => sum + r.value, 0);
  const sellValue = sellTrades.reduce((sum, r) => sum + r.value, 0);
  const total = buyValue + sellValue;
  if (!Number.isFinite(total) || total <= 0) throw new Error("Invalid total notional");
  const cvd = buyValue - sellValue;
  const buyRatio = total > 0 ? (buyValue / total) * 100 : 50;

  // Whale trades analysis (threshold >= 50,000 USDT)
  const whaleThreshold = 50000;
  const whaleTrades = rows.filter((r) => r.value >= whaleThreshold);
  const whaleBuyValue = whaleTrades.filter((r) => r.side === "buy").reduce((sum, r) => sum + r.value, 0);
  const whaleSellValue = whaleTrades.filter((r) => r.side === "sell").reduce((sum, r) => sum + r.value, 0);
  const whaleNetValue = whaleBuyValue - whaleSellValue;

  return {
    count: rows.length,
    firstPrice: rows[0].price, lastPrice: rows[rows.length - 1].price,
    megaCount: rows.filter((r) => r.value >= 100000).length,
    megaBuyValue: rows.filter((r) => r.value >= 100000 && r.side === "buy").reduce((sum, r) => sum + r.value, 0),
    megaSellValue: rows.filter((r) => r.value >= 100000 && r.side === "sell").reduce((sum, r) => sum + r.value, 0),
    from: rows[0].time,
    to: rows[rows.length - 1].time,
    buyValue,
    sellValue,
    cvd,
    buyRatio,
    whaleTradesCount: whaleTrades.length,
    whaleBuyValue,
    whaleSellValue,
    whaleNetValue,
    largest: rows.sort((a, b) => b.value - a.value).slice(0, 10),
  };
}
export function parseFunding(value: unknown, symbol: string): NonNullable<CryptoFlow["derivatives"]> {
  const row = record(value);
  if (row.symbol !== symbol) throw new Error("Wrong symbol");
  const fundingPercent = numeric(row.lastFundingRate) * 100;
  const annualizedFundingPercent = null;

  let fundingBias: NonNullable<CryptoFlow["derivatives"]>["fundingBias"] = "NEUTRAL";
  if (fundingPercent > 0.04) fundingBias = "EXTREME_LONG";
  else if (fundingPercent > 0.015) fundingBias = "LONG_BIAS";
  else if (fundingPercent < -0.02) fundingBias = "EXTREME_SHORT";
  else if (fundingPercent < 0) fundingBias = "SHORT_BIAS";

  return {
    fundingPercent,
    annualizedFundingPercent,
    nextFundingTime: positive(row.nextFundingTime),
    markPrice: positive(row.markPrice),
    time: positive(row.time),
    fundingBias,
  };
}
export function parseOpenInterest(value: unknown, symbol: string): NonNullable<CryptoFlow["openInterest"]> {
  const row = record(value);
  if (row.symbol !== symbol) throw new Error("Wrong symbol");
  const quantity = numeric(row.openInterest);
  if (quantity < 0) throw new Error("Invalid open interest");
  return { quantity, time: positive(row.time) };
}


export function freshCryptoFlow(flow: CryptoFlow | null | undefined, now: number, symbol?: string): CryptoFlow | null {
  if (!flow || (symbol && flow.symbol !== symbol) || !Number.isFinite(flow.fetchedAt) || flow.fetchedAt > now + 5000 || now - flow.fetchedAt > 60000) return null;
  const fresh = (time: number, age: number) => Number.isFinite(time) && time <= now + 5000 && now - time <= age;
  return { ...flow,
    trades: flow.trades && fresh(flow.trades.to, 60000) && flow.trades.from <= flow.trades.to ? flow.trades : null,
    derivatives: flow.derivatives && fresh(flow.derivatives.time, 120000) ? flow.derivatives : null,
    openInterest: flow.openInterest && fresh(flow.openInterest.time, 120000) ? flow.openInterest : null,
  };
}
