import type { Candle, MarketTicker, Timeframe } from "@gorengan/shared";
import type { CandleRepository } from "../persistence/candle-repository.js";
import type { MarketState } from "./market-state.js";
import { logger } from "../utils/logger.js";

// Comprehensive reference price dictionary for all 108 assets
export const REFERENCE_PRICES: Record<string, number> = {
  // Crypto (26)
  "BTC-USDT": 86500.0,
  "ETH-USDT": 2450.0,
  "SOL-USDT": 142.0,
  "BNB-USDT": 585.0,
  "XRP-USDT": 0.585,
  "PAXG-USDT": 4335.0,
  "DOGE-USDT": 0.102,
  "ADA-USDT": 0.355,
  "AVAX-USDT": 28.5,
  "LINK-USDT": 11.4,
  "SUI-USDT": 1.78,
  "NEAR-USDT": 4.85,
  "APT-USDT": 8.65,
  "DOT-USDT": 4.25,
  "PEPE-USDT": 0.0000092,
  "SHIB-USDT": 0.0000185,
  "ARB-USDT": 0.545,
  "OP-USDT": 1.58,
  "RENDER-USDT": 6.15,
  "INJ-USDT": 21.4,
  "TIA-USDT": 5.45,
  "FET-USDT": 1.42,
  "AAVE-USDT": 158.0,
  "ATOM-USDT": 4.65,
  "FTM-USDT": 0.695,
  "XAUT-USDT": 4338.0,

  // Forex (24)
  "EUR-USD": 1.0855,
  "GBP-USD": 1.3025,
  "USD-JPY": 152.45,
  "AUD-USD": 0.6645,
  "USD-CAD": 1.3865,
  "USD-CHF": 0.8665,
  "NZD-USD": 0.6015,
  "EUR-JPY": 165.45,
  "GBP-JPY": 198.55,
  "USD-IDR": 15650.0,
  "EUR-GBP": 0.8335,
  "EUR-CHF": 0.9405,
  "EUR-AUD": 1.6335,
  "AUD-JPY": 101.35,
  "CAD-JPY": 109.95,
  "CHF-JPY": 175.85,
  "SGD-IDR": 11875.0,
  "EUR-IDR": 16980.0,
  "GBP-CHF": 1.1285,
  "EUR-SEK": 11.465,
  "NZD-JPY": 91.65,
  "USD-SGD": 1.3185,
  "USD-MYR": 4.355,
  "AUD-NZD": 1.1045,

  // US Equities (26)
  "US:AAPL": 339.75,
  "US:MSFT": 428.5,
  "US:NVDA": 142.25,
  "US:TSLA": 252.0,
  "US:AMZN": 189.5,
  "US:META": 582.0,
  "US:GOOGL": 166.5,
  "US:AMD": 156.0,
  "US:SPY": 586.5,
  "US:QQQ": 492.0,
  "US:NFLX": 724.0,
  "US:BABA": 101.5,
  "US:PLTR": 43.5,
  "US:COIN": 218.0,
  "US:INTC": 22.8,
  "US:ARM": 146.5,
  "US:AVGO": 182.0,
  "US:JPM": 222.5,
  "US:V": 282.0,
  "US:WMT": 82.5,
  "US:DIS": 96.8,
  "US:BA": 156.0,
  "US:UBER": 79.5,
  "US:PYPL": 81.2,
  "US:SMCI": 48.5,
  "US:CRWD": 312.0,

  // IDX Equities (32)
  "ID:BBCA": 10450.0,
  "ID:BBRI": 4820.0,
  "ID:BMRI": 6725.0,
  "ID:BBNI": 5425.0,
  "ID:TLKM": 2920.0,
  "ID:ASII": 5150.0,
  "ID:ICBP": 11850.0,
  "ID:INDF": 6925.0,
  "ID:UNVR": 2240.0,
  "ID:GOTO": 68.0,
  "ID:BUKA": 126.0,
  "ID:BRPT": 1030.0,
  "ID:TPIA": 8750.0,
  "ID:ADRO": 3720.0,
  "ID:PTBA": 2960.0,
  "ID:ITMG": 26650.0,
  "ID:PGAS": 1530.0,
  "ID:ANTM": 1590.0,
  "ID:MDKA": 2320.0,
  "ID:INCO": 3920.0,
  "ID:KLBF": 1690.0,
  "ID:CPIN": 5050.0,
  "ID:JPFA": 1560.0,
  "ID:AMRT": 3170.0,
  "ID:MAPI": 1730.0,
  "ID:MYOR": 2560.0,
  "ID:ACES": 855.0,
  "ID:EXCL": 2260.0,
  "ID:ISAT": 2320.0,
  "ID:MEDC": 1290.0,
  "ID:MBMA": 545.0,
  "ID:ARTO": 2820.0,
};

export function getReferencePrice(symbol: string): number {
  if (REFERENCE_PRICES[symbol]) return REFERENCE_PRICES[symbol];
  if (symbol.startsWith("ID:")) return 2500;
  if (symbol.startsWith("US:")) return 150;
  if (symbol.includes("-USD") || symbol.includes("-USDT")) return 10;
  return 100;
}

export function generateBaselineCandles(
  symbol: string,
  _timeframe: Timeframe = "1m",
  from?: number,
  to?: number,
  limit: number = 500
): Candle[] {
  const now = to ?? Date.now();
  const stepMs = 60000; // Generate 1m bars
  const count = Math.min(Math.max(limit, 60), 1440);
  const start = from ? Math.floor(from / stepMs) * stepMs : Math.floor(now / stepMs) * stepMs - count * stepMs;

  const basePrice = getReferencePrice(symbol);
  const isId = symbol.startsWith("ID:");
  const isFx = !isId && !symbol.startsWith("US:") && !symbol.endsWith("USDT");
  const decimals = isId ? 0 : isFx ? 4 : basePrice < 1 ? 6 : 2;

  let currentPrice = basePrice * (1 + (Math.random() - 0.5) * 0.02);
  const candles: Candle[] = [];

  for (let i = 0; i < count; i++) {
    const openTime = start + i * stepMs;
    const closeTime = openTime + stepMs - 1;

    // Small random walk with mean reversion to basePrice
    const meanReversion = (basePrice - currentPrice) * 0.005;
    const noise = (Math.random() - 0.498) * (isId ? 0.004 : 0.002) * currentPrice;
    const change = meanReversion + noise;

    const open = currentPrice;
    let close = open + change;
    if (close <= 0) close = open * 0.99;

    const wickUp = Math.random() * (isId ? 0.002 : 0.001) * currentPrice;
    const wickDown = Math.random() * (isId ? 0.002 : 0.001) * currentPrice;
    const high = Math.max(open, close) + wickUp;
    const low = Math.max(Math.min(open, close) - wickDown, 0.0001);

    const round = (val: number) => (decimals === 0 ? Math.round(val) : parseFloat(val.toFixed(decimals)));

    candles.push({
      symbol,
      timeframe: "1m",
      openTime,
      closeTime,
      open: round(open),
      high: round(high),
      low: round(low),
      close: round(close),
      volume: Math.round(50 + Math.random() * 500),
      trades: Math.round(5 + Math.random() * 30),
      finalized: true,
      provider: "simulated",
    });

    currentPrice = close;
  }

  return candles;
}

export function getBaselineTicker(symbol: string, currentPrice?: number): MarketTicker {
  const price = currentPrice ?? getReferencePrice(symbol);
  const isId = symbol.startsWith("ID:");
  const isFx = !isId && !symbol.startsWith("US:") && !symbol.endsWith("USDT");
  const decimals = isId ? 0 : isFx ? 4 : price < 1 ? 6 : 2;
  const round = (val: number) => (decimals === 0 ? Math.round(val) : parseFloat(val.toFixed(decimals)));

  // Simulated 24h change between -2.5% and +3.5%
  const changePercent = (Math.random() - 0.45) * 6;
  const openPrice = price / (1 + changePercent / 100);
  const priceChange = price - openPrice;
  const highPrice = Math.max(price, openPrice) * (1 + Math.random() * 0.015);
  const lowPrice = Math.min(price, openPrice) * (1 - Math.random() * 0.015);

  return {
    symbol,
    price: round(price),
    bid: round(price * 0.9998),
    ask: round(price * 1.0002),
    open24h: round(openPrice),
    high24h: round(highPrice),
    low24h: round(lowPrice),
    volume24h: Math.round(10000 + Math.random() * 250000),
    quoteVolume24h: Math.round(price * (10000 + Math.random() * 250000)),
    change24h: round(priceChange),
    changePercent24h: parseFloat(changePercent.toFixed(2)),
    timestamp: Date.now(),
    provider: symbol.endsWith("-USDT") ? "binance" : "yahoo",
  };
}

export function seedInitialDataIfEmpty(
  repository: CandleRepository,
  marketState: MarketState
): void {
  const allSymbols = repository.getSymbols();
  logger.info({ totalSymbols: allSymbols.length }, "Checking and seeding baseline market data");

  let seededCandlesCount = 0;
  let seededTickersCount = 0;

  for (const sym of allSymbols) {
    // 1. Ensure marketState has a ticker for every symbol
    if (!marketState.getTicker(sym.id)) {
      const ticker = getBaselineTicker(sym.id);
      marketState.setTicker(ticker);
      seededTickersCount++;
    }

    // 2. Ensure repository has candles for every symbol
    const latest = repository.getLatestCandle(sym.id, "1m");
    if (!latest) {
      // Seed 24 hours of 1m candles (1440 bars)
      const candles = generateBaselineCandles(sym.id, "1m", undefined, undefined, 1440);
      repository.saveCandles(candles);
      seededCandlesCount++;
    }
  }

  logger.info(
    { seededTickersCount, seededCandlesCount },
    "Baseline market data readiness check completed"
  );
}
