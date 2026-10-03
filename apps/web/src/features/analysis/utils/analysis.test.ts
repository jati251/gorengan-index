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

test("forecast provides sigma envelopes, heuristic scenario weights and Parkinson volatility", () => {
  const candles = bars(60, (i) => 100 + i * 0.5 + (i % 2 === 0 ? 1 : -1));
  const result = forecastCandles(candles, 10)!;
  assert.ok(result.points95.length === 11);
  // Two-sigma envelope is wider than one-sigma envelope
  assert.ok(result.points95[10].upper >= result.points[10].upper);
  assert.ok(result.points95[10].lower <= result.points[10].lower);
  // Scenario weights sum to 100
  const { bull, base, bear } = result.scenarios;
  assert.ok(bull.weight > 0 && base.weight > 0 && bear.weight > 0);
  assert.equal(bull.weight + base.weight + bear.weight, 100);
  // Metrics contain valid Parkinson sigma and confidence score
  assert.ok(result.metrics.parkinsonSigma >= 0);
  assert.equal(result.metrics.directionalAccuracy, null);
  assert.equal(result.metrics.evaluation.samples, 0);
  assert.ok(result.metrics.pivotLevels.r1 > result.metrics.pivotLevels.s1);
});


test("rolling evaluation uses held-out non-overlapping outcomes and a last-price baseline", async () => {
  const { evaluateForecast } = await import("./analysis");
  const trend = evaluateForecast(bars(100, (i) => 100 * Math.exp(i * .001)), 10);
  assert.equal(trend.samples, 4); assert.equal(trend.directionalAccuracy, 100);
  assert.ok(trend.mape! < 1e-8); assert.ok(trend.baselineMape! > 0);
  const flat = evaluateForecast(bars(100, () => 100), 10);
  assert.equal(flat.directionalAccuracy, null); assert.equal(flat.mape, 0);
  const source = bars(70, (i) => 100 * Math.exp(i * .001));
  source[69].close = 1;
  const shock = evaluateForecast(source, 10);
  assert.equal(shock.samples, 1); assert.equal(shock.directionalAccuracy, 0); assert.ok(shock.mape! > 1000);
});
test("future and reversed-time candles cannot enter analysis", () => {
  const source = bars(60, () => 100);
  assert.equal(cleanCandles(source, "TEST-USDT", "1h", 3600000).length, 1);
  assert.equal(cleanCandles([{ ...source[0], closeTime: -1 }], "TEST-USDT", "1h").length, 0);
});

test("prediction screening withholds weak, stale and cost-dominated projections", async () => {
  const { evaluateForecast, forecastEvidence } = await import("./analysis");
  const evaluation = evaluateForecast(bars(400, (i) => 100 * Math.exp(i * .001)), 10);
  const options = { fresh: true, refreshFailed: false, costBps: 20 };
  assert.equal(evaluation.recentSamples, 10);
  assert.equal(forecastEvidence(evaluation, 1, options).eligible, true);
  assert.equal(forecastEvidence(evaluation, .1, options).eligible, false);
  assert.ok(forecastEvidence(evaluation, 1, { ...options, fresh: false }).reasons.includes("stale"));
  assert.ok(forecastEvidence(evaluation, 1, { ...options, refreshFailed: true }).reasons.includes("refresh_failed"));
  assert.ok(forecastEvidence(evaluation, 1, { ...options, costBps: NaN }).reasons.includes("cost"));
  assert.equal(forecastEvidence({ ...evaluation, mape: NaN, recentMape: NaN, directionalAccuracy: NaN }, 1, options).eligible, false);
  const weak = { ...evaluation, mape: evaluation.baselineMape! * 1.1 };
  assert.ok(forecastEvidence(weak, 1, options).reasons.includes("baseline"));
  const recentFailure = { ...evaluation, recentMape: evaluation.recentBaselineMape! * 2 };
  assert.ok(forecastEvidence(recentFailure, 1, options).reasons.includes("recent_baseline"));
  const short = evaluateForecast(bars(100, (i) => 100 * Math.exp(i * .001)), 10);
  assert.ok(forecastEvidence(short, 1, options).reasons.includes("insufficient_tests"));
});

test("recent evaluation reveals deterioration hidden by the full historical average", async () => {
  const { evaluateForecast } = await import("./analysis");
  const source = bars(400, (i) => i < 360 ? 100 * Math.exp(i * .001) : 100 * Math.exp(.36 - (i - 360) * .01));
  const result = evaluateForecast(source, 10);
  assert.equal(result.recentSamples, 10);
  assert.ok(result.recentMape! > result.mape!);
  assert.ok(result.recentBaselineMape! > result.baselineMape!);
});
