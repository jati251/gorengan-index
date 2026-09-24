#!/usr/bin/env node

/**
 * WebSocket Realtime Performance & Bandwidth Benchmark
 *
 * Usage:
 *   node scripts/ws-benchmark.mjs [options]
 *
 * Options:
 *   --url=<ws_url>          Target WS URL (default: wss://gorengan-index.cekcok.my.id/v1/stream)
 *   --duration=<seconds>    Test duration in seconds (default: 15)
 *   --channels=<c1,c2,...>  Channels to subscribe (default: ticker:*,candle:1s:*,session:*)
 */

const args = process.argv.slice(2).reduce((acc, arg) => {
  if (arg.startsWith("--")) {
    const [key, value] = arg.slice(2).split("=");
    acc[key] = value ?? true;
  }
  return acc;
}, {});

const WS_URL = args.url || process.env.WS_URL || "wss://gorengan-index.cekcok.my.id/v1/stream";
const DURATION_SEC = parseInt(args.duration || "15", 10);
const CHANNELS = args.channels
  ? args.channels.split(",")
  : ["ticker:*", "candle:1s:*", "candle:1m:*", "session:*"];

console.log("\n========================================================");
console.log("  GORENGAN REALTIME WEBSOCKET BENCHMARK SUITE");
console.log("========================================================");
console.log(`Endpoint  : ${WS_URL}`);
console.log(`Duration  : ${DURATION_SEC} seconds`);
console.log(`Channels  : ${CHANNELS.join(", ")}`);
console.log("Connecting...\n");

const ws = new WebSocket(WS_URL);

let startTime = 0;
let totalBytes = 0;
let totalMessages = 0;
const typeStats = {};
const payloadSizes = [];
const intervalDeltas = [];
let lastTimestamp = 0;

// Per-second sampling for peak throughput calculation
let currentSecondTicks = 0;
let currentSecondBytes = 0;
const perSecondRates = [];
let sampleInterval = null;

ws.onopen = () => {
  startTime = Date.now();
  lastTimestamp = startTime;
  console.log(`[CONNECTED] Started sampling live semburan data for ${DURATION_SEC}s...`);

  ws.send(JSON.stringify({
    op: "subscribe",
    channels: CHANNELS,
  }));

  sampleInterval = setInterval(() => {
    perSecondRates.push({
      ticks: currentSecondTicks,
      bytes: currentSecondBytes,
    });
    currentSecondTicks = 0;
    currentSecondBytes = 0;
  }, 1000);
};

ws.onmessage = (event) => {
  const now = Date.now();
  const raw = event.data;
  const byteLength = Buffer.byteLength(raw, "utf8");

  totalMessages++;
  totalBytes += byteLength;
  currentSecondTicks++;
  currentSecondBytes += byteLength;
  payloadSizes.push(byteLength);

  if (lastTimestamp > 0) {
    intervalDeltas.push(now - lastTimestamp);
  }
  lastTimestamp = now;

  try {
    const parsed = JSON.parse(raw);
    const type = parsed.type || "unknown";
    if (!typeStats[type]) {
      typeStats[type] = { count: 0, bytes: 0 };
    }
    typeStats[type].count++;
    typeStats[type].bytes += byteLength;
  } catch {
    // Malformed json
  }
};

ws.onerror = (err) => {
  console.error("[ERROR] WebSocket Error:", err.message || err);
};

ws.onclose = () => {
  if (sampleInterval) clearInterval(sampleInterval);
};

setTimeout(() => {
  if (ws.readyState === WebSocket.OPEN) {
    ws.close();
  }
  if (sampleInterval) clearInterval(sampleInterval);

  const elapsedSec = (Date.now() - startTime) / 1000;

  // Compute Statistics
  payloadSizes.sort((a, b) => a - b);
  intervalDeltas.sort((a, b) => a - b);

  const minPayload = payloadSizes[0] || 0;
  const maxPayload = payloadSizes[payloadSizes.length - 1] || 0;
  const avgPayload = totalMessages > 0 ? totalBytes / totalMessages : 0;
  const p50Payload = payloadSizes[Math.floor(payloadSizes.length * 0.5)] || 0;
  const p95Payload = payloadSizes[Math.floor(payloadSizes.length * 0.95)] || 0;

  const p50Interval = intervalDeltas[Math.floor(intervalDeltas.length * 0.5)] || 0;
  const p95Interval = intervalDeltas[Math.floor(intervalDeltas.length * 0.95)] || 0;
  const p99Interval = intervalDeltas[Math.floor(intervalDeltas.length * 0.99)] || 0;

  const avgMsgSec = totalMessages / elapsedSec;
  const avgKbSec = (totalBytes / 1024) / elapsedSec;
  const avgMbps = ((totalBytes * 8) / (1024 * 1024)) / elapsedSec;

  const peakMsgSec = perSecondRates.reduce((max, r) => Math.max(max, r.ticks), 0);
  const peakKbSec = perSecondRates.reduce((max, r) => Math.max(max, r.bytes / 1024), 0);

  console.log("\n========================================================");
  console.log("            BENCHMARK RESULTS & METRICS");
  console.log("========================================================");
  console.log(`Elapsed Time            : ${elapsedSec.toFixed(2)} seconds`);
  console.log(`Total Messages Received : ${totalMessages.toLocaleString()} msgs`);
  console.log(`Total Data Ingested     : ${(totalBytes / 1024).toFixed(2)} KB (${(totalBytes / (1024 * 1024)).toFixed(2)} MB)\n`);

  console.log("--- [SPEED & THROUGHPUT] ---");
  console.log(`Average Message Rate    : ${avgMsgSec.toFixed(1)} msgs/sec`);
  console.log(`Peak Message Burst Rate : ${peakMsgSec} msgs/sec`);
  console.log(`Arrival Interval (p50)  : ${p50Interval} ms`);
  console.log(`Arrival Interval (p95)  : ${p95Interval} ms`);
  console.log(`Arrival Interval (p99)  : ${p99Interval} ms\n`);

  console.log("--- [BANDWIDTH CONSUMPTION] ---");
  console.log(`Average Throughput      : ${avgKbSec.toFixed(2)} KB/s (${avgMbps.toFixed(2)} Mbps)`);
  console.log(`Peak Bandwidth          : ${peakKbSec.toFixed(2)} KB/s (${((peakKbSec * 8) / 1024).toFixed(2)} Mbps)`);
  console.log(`Avg Payload Size        : ${avgPayload.toFixed(1)} bytes`);
  console.log(`Min Payload Size        : ${minPayload} bytes`);
  console.log(`Max Payload Size        : ${maxPayload} bytes`);
  console.log(`p50 Payload Size        : ${p50Payload} bytes`);
  console.log(`p95 Payload Size        : ${p95Payload} bytes\n`);

  console.log("--- [MESSAGE TYPE BREAKDOWN] ---");
  console.table(
    Object.entries(typeStats).map(([type, stats]) => ({
      "Message Type": type,
      "Count": stats.count,
      "% Share": `${((stats.count / totalMessages) * 100).toFixed(1)}%`,
      "Total (KB)": (stats.bytes / 1024).toFixed(1),
      "Avg Size (B)": (stats.bytes / stats.count).toFixed(0),
    }))
  );

  console.log("\n--- [FRONTEND RE-RENDER & FPS IMPACT] ---");
  console.log("• RAF Coalescing (Unthrottled Mode):");
  console.log(`  React only flushes at screen refresh rate (~60/120 Hz).`);
  console.log(`  With ${avgMsgSec.toFixed(0)} msgs/sec, ~${Math.ceil(avgMsgSec / 60)} updates coalesced per frame.`);
  console.log("• Throttled Mode (Preview / Guest):");
  console.log(`  Flushes once every 5000ms -> virtually 0% CPU impact.`);
  console.log("========================================================\n");

  process.exit(0);
}, DURATION_SEC * 1000);
