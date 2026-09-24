#!/usr/bin/env node

/**
 * Realtime Market Data Stream Terminal Viewer
 * Connects directly to the market data feed and renders live events
 * in a clean, color-coded tabular format.
 *
 * Usage:
 *   node scripts/tail-market.mjs [SYMBOLS...] [OPTIONS]
 *   ./scripts/tail-market.mjs BTCUSDT ETHUSDT SOLUSDT
 *   pnpm tail --trades-only --min-value=500
 *
 * Options:
 *   --trades-only        Show only individual trade executions
 *   --tickers-only       Show only 24h ticker price updates
 *   --min-value=<num>    Filter trades with minimum USD value (e.g. --min-value=1000)
 *   --source=binance     Direct Binance WebSocket (default)
 *   --source=gateway     Local/cluster gateway WebSocket (default: ws://localhost:9001/v1/stream)
 *   --url=<ws_url>       Custom WebSocket URL
 *   --help, -h           Show help instructions
 */

// ANSI Color Codes
const c = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  italic: "\x1b[3m",
  underline: "\x1b[4m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",
  bgRed: "\x1b[41m",
  bgGreen: "\x1b[42m",
  bgDark: "\x1b[100m",
};

// Parse CLI Arguments
const rawArgs = process.argv.slice(2);

if (rawArgs.includes("-h") || rawArgs.includes("--help")) {
  console.log(`
${c.bold}${c.cyan}=== Gorengan Index - Realtime Market Stream Terminal ===${c.reset}

${c.bold}Cara Pakai:${c.reset}
  node scripts/tail-market.mjs [SYMBOLS...] [OPTIONS]
  ./scripts/tail-market.mjs BTCUSDT ETHUSDT SOLUSDT

${c.bold}Opsi:${c.reset}
  ${c.yellow}--trades-only${c.reset}        Hanya tampilkan eksekusi trade transaksi individual
  ${c.yellow}--tickers-only${c.reset}       Hanya tampilkan pembaruan ticker 24h & harga terkini
  ${c.yellow}--min-value=<num>${c.reset}    Filter trade dengan nilai nominal USD minimal (contoh: --min-value=1000)
  ${c.yellow}--source=binance${c.reset}     Connect langsung ke Binance WebSocket gateway (default)
  ${c.yellow}--source=gateway${c.reset}     Connect ke Gorengan Gateway API (default ws://localhost:9001/v1/stream)
  ${c.yellow}--url=<url>${c.reset}          Kustom WebSocket URL tujuan
  ${c.yellow}-h, --help${c.reset}            Tampilkan panduan ini

${c.bold}Contoh Perintah:${c.reset}
  ${c.dim}# Pantau BTC & ETH standar:${c.reset}
  node scripts/tail-market.mjs BTCUSDT ETHUSDT

  ${c.dim}# Pantau whale trades (nilai transaksi >= $5,000):${c.reset}
  node scripts/tail-market.mjs BTCUSDT SOLUSDT --trades-only --min-value=5000
`);
  process.exit(0);
}

// Config Extraction
const symbolsArg = rawArgs
  .filter((a) => !a.startsWith("-"))
  .flatMap((s) => s.split(","))
  .map((s) => s.trim().toUpperCase())
  .filter(Boolean);

const defaultSymbols = ["BTCUSDT", "ETHUSDT", "SOLUSDT"];
const symbols = symbolsArg.length > 0 ? symbolsArg : defaultSymbols;

const tradesOnly = rawArgs.includes("--trades-only");
const tickersOnly = rawArgs.includes("--tickers-only");
const minValueArg = rawArgs.find((a) => a.startsWith("--min-value="));
const minValue = minValueArg ? parseFloat(minValueArg.split("=")[1]) || 0 : 0;

const sourceArg = rawArgs.find((a) => a.startsWith("--source="));
const source = sourceArg ? sourceArg.split("=")[1].toLowerCase() : "binance";

const customUrlArg = rawArgs.find((a) => a.startsWith("--url="));
let wsUrl = customUrlArg ? customUrlArg.split("=")[1] : "";

if (!wsUrl) {
  if (source === "gateway") {
    wsUrl = "ws://localhost:9001/v1/stream";
  } else {
    // Binance combined stream
    const streams = [];
    for (const sym of symbols) {
      const lower = sym.toLowerCase();
      if (!tickersOnly) streams.push(`${lower}@trade`);
      if (!tradesOnly) streams.push(`${lower}@ticker`);
    }
    wsUrl = `wss://stream.binance.com:9443/stream?streams=${streams.join("/")}`;
  }
}

// Helpers
function formatTime(timestampMs = Date.now()) {
  const d = new Date(timestampMs);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  const ms = String(d.getMilliseconds()).padStart(3, "0");
  return `${hh}:${mm}:${ss}.${ms}`;
}

function formatNumber(num, decimals = 2) {
  const n = typeof num === "string" ? parseFloat(num) : num;
  if (isNaN(n)) return "-";
  return n.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function pad(str, len, align = "left") {
  const s = String(str);
  // remove ANSI for length calc
  const rawLen = s.replace(/\x1b\[[0-9;]*m/g, "").length;
  const diff = len - rawLen;
  if (diff <= 0) return s;
  return align === "right" ? " ".repeat(diff) + s : s + " ".repeat(diff);
}

// Header Printer
let rowCount = 0;
function printHeader() {
  console.log(
    `\n${c.bold}${c.white}` +
      pad("TIME", 13) +
      pad("EVENT", 9) +
      pad("SYMBOL", 11) +
      pad("SIDE", 7) +
      pad("PRICE", 15, "right") +
      pad("QTY", 14, "right") +
      pad("VALUE ($)", 16, "right") +
      pad("24h CHG", 12, "right") +
      "   " +
      pad("24h HIGH / LOW", 24) +
      c.reset
  );
  console.log(c.dim + "─".repeat(110) + c.reset);
}

// Stats Tracker
const stats = {
  tradesCount: 0,
  tickersCount: 0,
  totalVolumeUsd: 0,
  startTime: Date.now(),
};

function printBanner() {
  console.clear();
  console.log(`${c.bold}${c.cyan}┌──────────────────────────────────────────────────────────────┐${c.reset}`);
  console.log(`${c.bold}${c.cyan}│      📡 GORENGAN INDEX - REALTIME MARKET FEED TERMINAL       │${c.reset}`);
  console.log(`${c.bold}${c.cyan}└──────────────────────────────────────────────────────────────┘${c.reset}`);
  console.log(
    `${c.dim}Source :${c.reset} ${c.yellow}${source === "binance" ? "Binance Direct WebSocket" : wsUrl}${c.reset}`
  );
  console.log(`${c.dim}Symbols:${c.reset} ${c.bold}${symbols.join(", ")}${c.reset}`);
  if (minValue > 0) {
    console.log(`${c.dim}Filter :${c.reset} ${c.magenta}Min trade value >= $${minValue.toLocaleString()}${c.reset}`);
  }
  console.log(`${c.dim}Status :${c.reset} ${c.green}Connecting...${c.reset} ${c.dim}(Ctrl+C to quit)${c.reset}`);
  printHeader();
}

printBanner();

// Connect WebSocket
let ws = null;
let reconnectAttempts = 0;

function connect() {
  ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    reconnectAttempts = 0;
    const now = formatTime();
    console.log(
      `${c.dim}${now}${c.reset} ${c.bgGreen}${c.bold} CONNECTED ${c.reset} ${c.green}Listening to live semburan market feed...${c.reset}`
    );

    // If connecting to Gateway API, send subscribe message
    if (source === "gateway") {
      const subMsg = {
        action: "subscribe",
        channels: ["trades", "tickers"],
        instruments: symbols,
      };
      ws.send(JSON.stringify(subMsg));
    }
  };

  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);

      // 1. Binance format
      if (msg.stream) {
        handleBinanceStream(msg.stream, msg.data);
      }
      // 2. Direct Binance event or Gateway event
      else if (msg.e === "trade" || msg.type === "trade") {
        handleTrade(msg);
      } else if (msg.e === "24hrTicker" || msg.type === "ticker") {
        handleTicker(msg);
      }
    } catch {
      // Ignore unparseable frames
    }
  };

  ws.onerror = (err) => {
    console.log(`${c.red}[ERROR] WebSocket error: ${err.message || "Failed"}${c.reset}`);
  };

  ws.onclose = () => {
    reconnectAttempts++;
    const waitSec = Math.min(reconnectAttempts * 2, 10);
    console.log(
      `${c.yellow}[DISCONNECTED] Stream terputus. Mencoba reconnect dalam ${waitSec} detik...${c.reset}`
    );
    setTimeout(connect, waitSec * 1000);
  };
}

function handleBinanceStream(stream, data) {
  if (stream.includes("@trade")) {
    handleTrade(data);
  } else if (stream.includes("@ticker")) {
    handleTicker(data);
  }
}

function handleTrade(t) {
  if (tickersOnly) return;

  const symbol = t.s || t.symbol || "-";
  const price = parseFloat(t.p || t.price || 0);
  const qty = parseFloat(t.q || t.quantity || 0);
  const val = price * qty;

  if (minValue > 0 && val < minValue) return;

  // Buyer maker = true -> taker is seller -> SELL
  // Buyer maker = false -> taker is buyer -> BUY
  const isBuyerMaker = t.m !== undefined ? t.m : t.side === "sell";
  const isBuy = !isBuyerMaker;
  const sideColor = isBuy ? c.green : c.red;
  const sideText = isBuy ? "BUY" : "SELL";
  const priceColor = isBuy ? c.green : c.red;

  const timeStr = formatTime(t.T || t.timestamp || Date.now());

  stats.tradesCount++;
  stats.totalVolumeUsd += val;

  const eventBadge = `${c.cyan}TRADE${c.reset}`;
  const sideBadge = `${sideColor}${c.bold}${sideText}${c.reset}`;
  const priceStr = `${priceColor}${formatNumber(price, price < 1 ? 6 : 2)}${c.reset}`;
  const qtyStr = formatNumber(qty, qty < 1 ? 4 : 2);
  const valStr = `${c.bold}$${formatNumber(val, 2)}${c.reset}`;

  // Whale highlight if value >= $10,000
  const whaleTag = val >= 10000 ? ` ${c.bgRed}${c.bold} WHALE! ${c.reset}` : "";

  console.log(
    pad(timeStr, 13) +
      pad(eventBadge, 9) +
      pad(symbol, 11) +
      pad(sideBadge, 7) +
      pad(priceStr, 15, "right") +
      pad(qtyStr, 14, "right") +
      pad(valStr, 16, "right") +
      pad("-", 12, "right") +
      "   " +
      pad(`${c.dim}trade #${t.t || "-"}${c.reset}${whaleTag}`, 24)
  );

  rowCount++;
  if (rowCount % 30 === 0) {
    printHeader();
  }
}

function handleTicker(tk) {
  if (tradesOnly) return;

  const symbol = tk.s || tk.symbol || "-";
  const lastPrice = parseFloat(tk.c || tk.last_price || 0);
  const pctChange = parseFloat(tk.P || tk.price_change_percent || 0);
  const high = parseFloat(tk.h || tk.high_price || 0);
  const low = parseFloat(tk.l || tk.low_price || 0);

  const pctColor = pctChange >= 0 ? c.green : c.red;
  const pctSign = pctChange >= 0 ? "+" : "";
  const pctStr = `${pctColor}${c.bold}${pctSign}${pctChange.toFixed(2)}%${c.reset}`;

  const timeStr = formatTime(tk.E || Date.now());
  const eventBadge = `${c.yellow}TICKER${c.reset}`;
  const priceStr = `${pctColor}${formatNumber(lastPrice, lastPrice < 1 ? 6 : 2)}${c.reset}`;
  const highLowStr = `${c.green}H:${formatNumber(high, high < 1 ? 4 : 2)}${c.reset} ${c.dim}/${c.reset} ${c.red}L:${formatNumber(low, low < 1 ? 4 : 2)}${c.reset}`;

  stats.tickersCount++;

  console.log(
    pad(timeStr, 13) +
      pad(eventBadge, 9) +
      pad(symbol, 11) +
      pad("•", 7) +
      pad(priceStr, 15, "right") +
      pad("-", 14, "right") +
      pad("-", 16, "right") +
      pad(pctStr, 12, "right") +
      "   " +
      pad(highLowStr, 24)
  );

  rowCount++;
  if (rowCount % 30 === 0) {
    printHeader();
  }
}

connect();

// Graceful Exit
process.on("SIGINT", () => {
  const durationSec = Math.max(1, Math.round((Date.now() - stats.startTime) / 1000));
  console.log(`\n\n${c.bold}${c.cyan}=== Sesi Pemantauan Selesai ===${c.reset}`);
  console.log(`⏱️  Durasi Stream  : ${durationSec} detik`);
  console.log(`📊 Total Trade    : ${stats.tradesCount.toLocaleString()} transaksi`);
  console.log(`📈 Total Ticker   : ${stats.tickersCount.toLocaleString()} tick updates`);
  console.log(`💰 Total Volume   : $${formatNumber(stats.totalVolumeUsd, 2)}`);
  console.log(`${c.dim}Sampai jumpa! 👋${c.reset}\n`);

  if (ws) {
    ws.close();
  }
  process.exit(0);
});
