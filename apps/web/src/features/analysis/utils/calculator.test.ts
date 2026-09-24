import { test } from "node:test";
import assert from "node:assert/strict";
import { calculateTrade } from "./calculator";
import { formatPercent, formatPrice, formatVolume } from "../../../utils/formatters";

test("spot calculator includes both fees, capital and break-even", () => {
  const result = calculateTrade(1000, 100, 110, 1)!;
  assert.ok(Math.abs(result.profit - 78.21782178217836) < 1e-9);
  assert.ok(Math.abs(result.quantity * 100 * 1.01 - 1000) < 1e-9);
  assert.ok(Math.abs(calculateTrade(1000, 100, result.breakEven, 1)!.profit) < 1e-9);
  assert.equal(calculateTrade(1000, 100, 0, 0)!.profit, -1000);
  assert.equal(calculateTrade(1000, 100, 110, 0)!.profit, 100);
});

test("invalid input produces no result", () => {
  for (const args of [[0, 1, 2, 0], [10, 0, 2, 0], [10, 1, -2, 0], [10, 1, 2, 100], [NaN, 1, 2, 0], [Infinity, 1, 2, 0]]) {
    assert.equal(calculateTrade(...args as [number, number, number, number]), null);
  }
});

test("missing market data is distinct from a real zero", () => {
  for (const missing of [undefined, null, NaN, Infinity]) {
    assert.equal(formatPrice(missing), "—");
    assert.equal(formatPercent(missing), "—");
    assert.equal(formatVolume(missing), "—");
  }
  assert.equal(formatPercent(0), "0.00%");
  assert.equal(formatVolume(0), "0.00");
});
