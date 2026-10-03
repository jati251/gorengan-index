import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { activityRows, archiveSnapshots, HISTORY_URL, ISSUER_URL, parseHoldingHistory, parseReportedFlows } from "./etfActivity";

const sample = (date: string, holdings: string, flowUsd: string | null = null) => ({ ticker: "IBIT", asset: "btc", date, holdings, flowUsd });
test("holdings archive distinguishes derived USD, null baseline and zero changes", () => {
  const rows = parseHoldingHistory(JSON.stringify({ data: [sample("2024-01-12", "110", "1234"), sample("2024-01-11", "100")] }));
  assert.equal(rows[0].estimatedHoldingsChangeUsd, null);
  const result = activityRows(rows.map((r) => ({ date: r.date, btcHeld: r.btcHeld, sourceUrl: HISTORY_URL, observedAt: 1 })), rows, []);
  assert.equal(result[0].holdingsChangeBtc, 10); assert.equal(result[0].estimatedHoldingsChangeUsd, 1234);
  assert.equal(result[0].netFlowUsd, null); assert.equal(result[1].holdingsChangeBtc, null);
  for (const invalid of [sample("2024-02-30", "100"), sample("2024-01-12", "NaN"), sample("2024-01-12", "100", "oops")]) {
    assert.throws(() => parseHoldingHistory(JSON.stringify({ data: [invalid] })));
  }
  assert.throws(() => parseHoldingHistory(JSON.stringify({ data: [sample("2024-01-12", "100"), sample("2024-01-12", "200")] })));
});
test("reported flows use IBIT header position, USD millions, parentheses and unknown rather than zero", () => {
  const raw = '<table><tr><th>Date</th><th>FBTC</th><th>IBIT</th></tr><tr><td>11 Jan 2024</td><td>999</td><td>(12.5)</td></tr><tr><td>12 Jan 2024</td><td>1</td><td>0.0</td></tr><tr><td>15 Jan 2024</td><td>-</td><td>-</td></tr></table>';
  assert.deepEqual(parseReportedFlows(raw).map((r) => r.netFlowUsd), [-12500000, 0, null]);
  assert.throws(() => parseReportedFlows('<html>challenge</html>'));
  assert.throws(() => parseReportedFlows(raw.replace('(12.5)', '(12.5')));
  assert.throws(() => parseReportedFlows(raw.replace('<td>(12.5)</td>', '')));
});
test("gaps compare actual disclosure dates; official correction invalidates derived dollar estimate", () => {
  const history = parseHoldingHistory(JSON.stringify({ data: [sample("2024-01-11", "100"), sample("2024-01-16", "110", "1000")] }));
  const snapshots = history.map((r) => ({ date: r.date, btcHeld: r.btcHeld, sourceUrl: HISTORY_URL, observedAt: 1 }));
  snapshots[0].btcHeld = 99;
  const rows = activityRows(snapshots, history, [{ date: "2024-01-17", netFlowUsd: 0 }]);
  assert.equal(rows[0].btcHeld, null); assert.equal(rows[0].netFlowUsd, 0);
  assert.equal(rows[1].holdingsChangeBtc, 11); assert.equal(rows[1].previousHoldingsDate, "2024-01-11");
  assert.equal(rows[1].estimatedHoldingsChangeUsd, null);
});
test("local snapshots survive reload, serialize concurrent writes and preserve issuer priority", async () => {
  const dir = await mkdtemp(join(tmpdir(), "ibit-test-"));
  try {
    const one = { date: "2024-01-11", btcHeld: 100, sourceUrl: ISSUER_URL, observedAt: 1 };
    const two = { date: "2024-01-12", btcHeld: 110, sourceUrl: HISTORY_URL, observedAt: 2 };
    await Promise.all([archiveSnapshots([one], dir), archiveSnapshots([two], dir)]);
    const result = await archiveSnapshots([{ ...one, btcHeld: 99, sourceUrl: HISTORY_URL }], dir);
    assert.equal(result.length, 2); assert.equal(result[0].btcHeld, 100);
    const text = await readFile(join(dir, "holdings.json"), "utf8");
    await archiveSnapshots([{ ...one, observedAt: 100 }], dir);
    assert.equal(await readFile(join(dir, "holdings.json"), "utf8"), text);
    assert.deepEqual(await archiveSnapshots([], dir), result);
    await writeFile(join(dir, "holdings.json"), "corrupt");
    await assert.rejects(archiveSnapshots([], dir));
    assert.equal(await readFile(join(dir, "holdings.json"), "utf8"), "corrupt");
  } finally { await rm(dir, { recursive: true, force: true }); }
});
