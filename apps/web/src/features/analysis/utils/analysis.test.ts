import { test } from "node:test";
import assert from "node:assert/strict";
import type { Candle, MarketSymbol, MarketTicker } from "@gorengan/shared";
import { analyzeCandles, cleanCandles, ema, forecastCandles, marketComposition, rsi } from "./analysis";

const bars = (count: number, close: (i: number) => number): Candle[] => Array.from({ length: count }, (_, i) => ({
  symbol: "TEST-USDT", timeframe: "1h", openTime: i * 3600000, closeTime: (i + 1) * 3600000 - 1,
  open: close(i), close: close(i), high: close(i) + 1, low: close(i) - 1, volume: 100, finalized: true,
}));

test("flat, rising and falling series have bounded, meaningful RSI values", () => {
  assert.equal(rsi(Array(30).fill(100)), 50);
  assert.equal(rsi(Array.from({ length: 30 }, (_, i) => 100 + i)), 100);
  assert.equal(rsi(Array.from({ length: 30 }, (_, i) => 100 - i)), 0);
  assert.equal(rsi([1, 2]), null);
  assert.equal(ema(Array(60).fill(100), 20), 100);
});

test("analysis discards wrong instruments, unfinished/synthetic/invalid bars and duplicate times", () => {
  const source = bars(60, () => 100);
  const cleaned = cleanCandles([
    ...source.toReversed(), source[0],
    { ...source[0], symbol: "OTHER" }, { ...source[0], timeframe: "1d" },
    { ...source[0], openTime: 900000000, finalized: false },
    { ...source[0], openTime: 900000001, synthetic: true },
    { ...source[0], openTime: 900000002, low: -1 },
  ], "TEST-USDT", "1h");
  assert.equal(cleaned.length, 60);
  assert.equal(cleaned[0].openTime, 0);
  assert.equal(analyzeCandles(cleaned)?.support, 99);
  assert.equal(analyzeCandles(cleaned)?.resistance, 101);
});

test("forecast requires history and does not invent movement on flat data", () => {
  assert.equal(forecastCandles(bars(59, () => 100), 5), null);
  const result = forecastCandles(bars(60, () => 100), 10)!;
  assert.deepEqual(result.target, { step: 10, mid: 100, lower: 100, upper: 100 });
  assert.equal(forecastCandles(bars(60, () => 100), 0), null);
});

test("EMA and Wilder RSI match known reference calculations", () => {
  assert.equal(ema(Array.from({ length: 60 }, (_, i) => i + 1), 20), 50.5);
  const closes = [44.34, 44.09, 44.15, 43.61, 44.33, 44.83, 45.10, 45.42, 45.84, 46.08, 45.89, 46.03, 45.61, 46.28, 46.28];
  assert.ok(Math.abs(rsi(closes)! - 70.464135) < .00001);
  const result = analyzeCandles(bars(60, () => 100))!;
  assert.equal(result.atr, 2);
  assert.equal(result.trend, "mixed");
});

test("constant log growth projects the same drift and volatile scenarios widen with horizon", () => {
  const growth = forecastCandles(bars(60, (i) => 100 * Math.exp(.001 * i)), 10)!;
  assert.ok(Math.abs(growth.target.mid - 100 * Math.exp(.069)) < 1e-8);
  const volatile = forecastCandles(bars(60, (i) => 100 + (i % 2 ? 3 : -3)), 20)!;
  assert.ok(volatile.target.lower > 0);
  assert.ok(volatile.points[20].upper - volatile.points[20].lower > volatile.points[5].upper - volatile.points[5].lower);
});

test("pie counts instruments once and preserves missing market changes", () => {
  const symbols = [{ id: "BTC-USDT", assetClass: "crypto" }, { id: "ID:BBCA", assetClass: "idx_stocks" }] as MarketSymbol[];
  const tickers: Record<string, MarketTicker> = { "BTC-USDT": { symbol: "BTC-USDT", timestamp: 0, price: 100, provider: "test", changePercent24h: 0 } };
  assert.equal(marketComposition([...symbols, symbols[0]], tickers, "assets").reduce((sum, item) => sum + item.count, 0), 2);
  assert.equal(marketComposition(symbols, tickers, "breadth").find((item) => item.key === "missing")?.count, 1);
  assert.equal(marketComposition(symbols, tickers, "breadth").find((item) => item.key === "flat")?.count, 1);
});
