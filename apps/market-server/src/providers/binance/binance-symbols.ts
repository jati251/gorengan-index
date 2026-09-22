// Canonical symbol <-> Binance symbol mapping

const CANONICAL_TO_BINANCE: Record<string, string> = {
  "BTC-USDT": "BTCUSDT",
  "ETH-USDT": "ETHUSDT",
  "SOL-USDT": "SOLUSDT",
  "BNB-USDT": "BNBUSDT",
  "XRP-USDT": "XRPUSDT",
  "PAXG-USDT": "PAXGUSDT",
};

const BINANCE_TO_CANONICAL: Record<string, string> = Object.entries(
  CANONICAL_TO_BINANCE
).reduce((acc, [canonical, binance]) => {
  acc[binance.toUpperCase()] = canonical;
  return acc;
}, {} as Record<string, string>);

export function toBinanceSymbol(canonicalSymbol: string): string {
  if (CANONICAL_TO_BINANCE[canonicalSymbol]) {
    return CANONICAL_TO_BINANCE[canonicalSymbol];
  }
  return canonicalSymbol.replace("-", "").toUpperCase();
}

export function toCanonicalSymbol(binanceSymbol: string): string {
  const upper = binanceSymbol.toUpperCase();
  if (BINANCE_TO_CANONICAL[upper]) {
    return BINANCE_TO_CANONICAL[upper];
  }
  // Fallback for standard USDT pairs
  if (upper.endsWith("USDT")) {
    return `${upper.slice(0, -4)}-USDT`;
  }
  return upper;
}
