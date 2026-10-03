import { test } from "node:test";
import assert from "node:assert/strict";
import type { Candle, MarketSymbol, MarketTicker } from "@gorengan/shared";
import { CandleRepository } from "../persistence/candle-repository.js";
import { QuestDbClient } from "../persistence/database.js";
import { CandleEngine } from "./candle-engine.js";
import { YahooMarketProvider } from "../providers/yahoo/yahoo-provider.js";
class MemoryDb extends QuestDbClient { constructor() { super("http://unused.invalid"); } override async writeIlp() {} }
const candle = (timeframe: Candle["timeframe"], openTime = 0): Candle => ({ symbol: "BTC-USDT", timeframe, openTime, closeTime: openTime + (timeframe === "1s" ? 999 : timeframe === "1h" ? 3599999 : 59999), open: 100, high: 101, low: 99, close: 100, volume: 10, finalized: true });
test("native timeframes remain separate and minute bars never impersonate seconds", () => {
  const repository = new CandleRepository(new MemoryDb());
  repository.saveCandle(candle("1m")); repository.saveCandle({ ...candle("1h"), close: 101 });
  assert.equal(repository.getCandles("BTC-USDT", "1h")[0].timeframe, "1h");
  assert.equal(repository.getCandles("BTC-USDT", "1m")[0].close, 100);
  assert.equal(repository.getCandles("BTC-USDT", "1s").length, 0);
  repository.saveCandle(candle("1s")); assert.equal(repository.getCandles("BTC-USDT", "1s")[0].closeTime, 999);
});
test("rollups preserve synthetic flags and cannot finalize the active interval", () => {
  const repository = new CandleRepository(new MemoryDb());
  const open = Math.floor(Date.now() / 300000) * 300000;
  repository.saveCandle({ ...candle("1m", open), synthetic: true });
  const rollup = repository.getCandles("BTC-USDT", "5m")[0];
  assert.equal(rollup.finalized, false); assert.equal(rollup.synthetic, true);
});
test("late and invalid trades cannot corrupt the current candle", () => {
  const repository = new CandleRepository(new MemoryDb()), engine = new CandleEngine(repository);
  try {
    const timestamp = Date.now(), trade = { symbol: "BTC-USDT", provider: "test", price: 100, quantity: 2, timestamp };
    engine.processTrade(trade); engine.processTrade({ ...trade, price: 1, timestamp: timestamp - 60000 }); engine.processTrade({ ...trade, quantity: -10 });
    assert.equal(engine.getCurrentCandle("BTC-USDT")?.close, 100); assert.equal(engine.getCurrentCandle("BTC-USDT")?.volume, 2);
  } finally { engine.stop(); }
});
test("Yahoo preserves bar durations, source time, missing volume and emits no fabricated trades", async () => {
  const original = globalThis.fetch;
  const symbol = { id: "US:TEST", providerSymbol: "TEST", assetClass: "us_stocks", provider: "yahoo" } as MarketSymbol;
  const provider = new YahooMarketProvider([symbol]);
  const time = Math.floor(Date.now() / 1000) - 7200;
  globalThis.fetch = async () => new Response(JSON.stringify({ chart: { result: [{ meta: { regularMarketPrice: 102, regularMarketTime: time, chartPreviousClose: 100 }, timestamp: [time], indicators: { quote: [{ open: [100], high: [103], low: [99], close: [102], volume: [123] }] } }] } }));
  const trades: unknown[] = [], tickers: MarketTicker[] = [];
  provider.on("trade", (trade) => trades.push(trade)); provider.on("ticker", (ticker) => tickers.push(ticker));
  try {
    const bars = await provider.getHistoricalCandles({ symbol: "US:TEST", timeframe: "1h", from: 0, to: Date.now() });
    assert.equal(bars[0].closeTime - bars[0].openTime, 3599999); assert.equal(bars[0].finalized, true);
    await (provider as unknown as { pollSingleSymbol: (s: MarketSymbol) => Promise<void> }).pollSingleSymbol(symbol);
    assert.equal(trades.length, 0); assert.equal(tickers[0].timestamp, time * 1000); assert.equal(tickers[0].volume24h, undefined); assert.equal(tickers[0].bid, undefined);
    assert.equal((await provider.getHistoricalCandles({ symbol: "US:TEST", timeframe: "1s", from: 0, to: Date.now() })).length, 0);
  } finally { globalThis.fetch = original; await provider.disconnect(); }
});
