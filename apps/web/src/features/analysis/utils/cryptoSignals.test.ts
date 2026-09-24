import { test } from "node:test";
import assert from "node:assert/strict";
import type { Candle } from "@gorengan/shared";
import { marketSignals, positionPlan } from "./cryptoSignals";
import { parseDepth, parseTrades, parseFunding, parseOpenInterest } from "./cryptoFlow";

test("breakout compares against previous bars and RVOL excludes current volume", () => {
  const candles: Candle[] = Array.from({ length: 60 }, (_, i) => ({ symbol: "BTC-USDT", timeframe: "1m", openTime: i * 60000, closeTime: (i + 1) * 60000 - 1, open: 100, high: 101, low: 99, close: 100, volume: 10, finalized: true }));
  candles[59] = { ...candles[59], high: 105, close: 104, volume: 30 };
  const result = marketSignals(candles, "BTC-USDT", "1m", 3600000)!;
  assert.equal(result.breakout, true);
  assert.equal(result.priorHigh, 101);
  assert.equal(result.relativeVolume, 3);
  assert.equal(marketSignals(candles, "BTC-USDT", "1m", 3540000)?.breakout, false);
  assert.equal(marketSignals(candles, "ETH-USDT", "1m", 3600000), null);
  candles[58].volume = NaN;
  assert.equal(marketSignals(candles, "BTC-USDT", "1m", 3600000)?.relativeVolume, null);
});

test("position sizing obeys risk and cash budgets including both fees and slippage", () => {
  const input = { capital: 1000, riskPercent: 1, entry: 100, stop: 95, target: 110, feePercent: .1, slippagePercent: .1, lotSize: .001 };
  const result = positionPlan(input)!;
  assert.ok(result.plannedLoss <= 10);
  assert.ok(result.capitalUsed <= 1000);
  assert.ok(result.quantity > 0 && result.quantity < 2);
  assert.ok(result.rewardRisk < 2);
  assert.ok(result.breakEven > 100);
  assert.equal(positionPlan({ ...input, stop: 101 }), null);
  assert.equal(positionPlan({ ...input, capital: Infinity }), null);
  assert.equal(positionPlan({ ...input, lotSize: 0 }), null);
  assert.equal(positionPlan({ ...input, capital: .001, lotSize: 1 })?.quantity, 0);
});

test("book imbalance uses quote notional and rejects malformed or crossed books", () => {
  const depth = parseDepth({ bids: [["100", "2"]], asks: [["102", "1"]] });
  assert.equal(depth.bidValue, 200);
  assert.equal(depth.askValue, 102);
  assert.ok(Math.abs(depth.imbalance - 98 / 302 * 100) < 1e-8);
  assert.throws(() => parseDepth({ bids: [["105", "2"]], asks: [["102", "1"]] }));
  assert.throws(() => parseDepth({ bids: [], asks: [] }));
});

test("buyer maker means sell aggressor, duplicate trades do not inflate flow", () => {
  const buy = { a: 1, p: "100", q: "2", T: 1000, m: false };
  const flow = parseTrades([buy, buy, { ...buy, a: 2, T: 2000, m: true, q: "1" }]);
  assert.equal(flow.count, 2);
  assert.equal(flow.buyValue, 200);
  assert.equal(flow.sellValue, 100);
  assert.equal(flow.largest[0].side, "buy");
  assert.throws(() => parseTrades([{ ...buy, m: undefined }]));
  assert.throws(() => parseTrades([]));
});

test("derivative parsers preserve funding sign, zero OI and instrument identity", () => {
  assert.equal(parseFunding({ symbol: "BTCUSDT", lastFundingRate: "-0.0001", nextFundingTime: 2000, markPrice: "100", time: 1000 }, "BTCUSDT").fundingPercent, -.01);
  assert.equal(parseOpenInterest({ symbol: "BTCUSDT", openInterest: "0", time: 1000 }, "BTCUSDT").quantity, 0);
  assert.throws(() => parseOpenInterest({ symbol: "ETHUSDT", openInterest: "1", time: 1000 }, "BTCUSDT"));
  assert.throws(() => parseOpenInterest({ symbol: "BTCUSDT", openInterest: null, time: 1000 }, "BTCUSDT"));
});
