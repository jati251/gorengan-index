import assert from "node:assert/strict";
const web = process.env.SMOKE_WEB_URL ?? "http://localhost:3000";
const market = process.env.SMOKE_MARKET_URL ?? "http://localhost:9000/v1";
async function read(base, path) {
  const r = await fetch(base + path, { signal: AbortSignal.timeout(45000) });
  assert.equal(r.status, 200, `${path}: HTTP ${r.status}`);
  return r.json();
}
const radar = await read(web, "/api/whale-radar");
assert.ok(radar.sources.length > 0);
assert.equal(radar.etfSummary.fiveDayNetFlowUsd, null);
assert.equal(radar.stats.accumulationScore, null);
assert.ok(Array.isArray(radar.etfSummary.activity.rows));
assert.ok(radar.etfSummary.activity.rows.length > 1, "IBIT history needs multiple actual disclosures");
for (const row of radar.etfSummary.activity.rows) {
  assert.match(row.date, /^\d{4}-\d{2}-\d{2}$/);
  if (row.holdingsChangeBtc !== null) {
    const previous = radar.etfSummary.activity.rows.find((r) => r.date === row.previousHoldingsDate);
    assert.ok(previous && Math.abs((row.btcHeld - previous.btcHeld) - row.holdingsChangeBtc) < 1e-8);
  }
}
assert.equal(radar.etfSummary.activity.walletTracking, "unavailable");
for (const tx of radar.recentLargeTxs) { assert.equal(tx.type, "TRANSFER"); assert.ok(tx.amountBtc >= 5); }
const crypto = await read(web, "/api/crypto-intel?symbol=BTC-USDT");
assert.equal(crypto.symbol, "BTC-USDT");
if (crypto.trades) assert.ok(crypto.trades.count > 0 && crypto.trades.count <= 500);
const filings = await read(web, "/api/insider-filings");
assert.ok(filings.source);
for (const f of filings.filings) assert.match(f.url, /^https:\/\/www\.sec\.gov\/Archives\/edgar\/data\//);
if (filings.filings.length) {
  const csv = await fetch(web + "/api/insider-filings?format=csv");
  assert.equal(csv.status, 200);
  assert.match(csv.headers.get("content-type"), /text\/csv/);
  assert.match(await csv.text(), /^"Accession","Form","Filed date"/);
}
const invalid = await fetch(web + "/api/crypto-intel?symbol=../bad"); assert.equal(invalid.status, 400);
const invalidHistory = await fetch(market + "/candles/BTC-USDT?timeframe=nope"); assert.equal(invalidHistory.status, 400);
const bars = await read(market, "/candles/BTC-USDT?timeframe=1h&limit=200");
assert.ok(bars.candles.length >= 60, "Live history must contain at least 60 bars");
assert.ok(bars.candles.every((c) => c.timeframe === "1h" && c.closeTime - c.openTime === 3599999));
console.log(JSON.stringify({
  checkedAt: new Date().toISOString(), realSpotTrades: crypto.trades?.count ?? 0,
  liveHistoryBars: bars.candles.length, secFilings: filings.filings.length, secStatus: filings.source.status,
  ibitHoldings: radar.etfSummary.ibit.btcHeld, holdingsDate: radar.etfSummary.holdingsAsOf,
  ibitHistoryRows: radar.etfSummary.activity.rows.length, latestIbitActivity: radar.etfSummary.activity.rows[0],
  bitcoinSample: radar.recentLargeTxs.length, news: radar.vipSocialFeed.posts.length,
  unavailable: radar.sources.filter((s) => s.status === "unavailable").map((s) => s.source),
  derivativesUnavailable: crypto.unavailable,
}, null, 2));
if (!crypto.trades || filings.source.status === "unavailable" || radar.etfSummary.ibit.btcHeld === null) {
  console.error("Partial live coverage: unavailable providers are explicit; full provider verification has not passed.");
  process.exitCode = 2;
}
