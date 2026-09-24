import type { Candle, MarketSymbol, MarketTicker, Timeframe } from "@gorengan/shared";

export function cleanCandles(candles: Candle[], symbol: string, timeframe: Timeframe): Candle[] {
  const unique = new Map<number, Candle>();
  for (const candle of candles) {
    if (candle.symbol !== symbol || candle.timeframe !== timeframe || !candle.finalized || candle.synthetic) continue;
    if (![candle.openTime, candle.closeTime, candle.open, candle.high, candle.low, candle.close].every(Number.isFinite)) continue;
    if (candle.low <= 0 || candle.low > Math.min(candle.open, candle.close) || candle.high < Math.max(candle.open, candle.close)) continue;
    unique.set(candle.openTime, candle);
  }
  return [...unique.values()].sort((a, b) => a.openTime - b.openTime);
}

export function ema(values: number[], period: number): number | null {
  if (values.length < period) return null;
  let value = values.slice(0, period).reduce((sum, n) => sum + n, 0) / period;
  const weight = 2 / (period + 1);
  for (const close of values.slice(period)) value += weight * (close - value);
  return value;
}

export function rsi(values: number[], period = 14): number | null {
  if (values.length <= period) return null;
  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= period; i++) {
    const change = values[i] - values[i - 1];
    gain += Math.max(0, change) / period;
    loss += Math.max(0, -change) / period;
  }
  for (let i = period + 1; i < values.length; i++) {
    const change = values[i] - values[i - 1];
    gain = (gain * (period - 1) + Math.max(0, change)) / period;
    loss = (loss * (period - 1) + Math.max(0, -change)) / period;
  }
  if (gain === 0 && loss === 0) return 50;
  return loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
}

export function analyzeCandles(candles: Candle[]) {
  if (candles.length < 50) return null;
  const closes = candles.map((candle) => candle.close);
  const last = candles[candles.length - 1];
  const recent = candles.slice(-20);
  const fast = ema(closes, 20)!;
  const slow = ema(closes, 50)!;
  const strength = rsi(closes)!;
  const trueRanges = candles.slice(1).map((candle, i) => Math.max(candle.high - candle.low, Math.abs(candle.high - candles[i].close), Math.abs(candle.low - candles[i].close)));
  let atr = trueRanges.slice(0, 14).reduce((sum, value) => sum + value, 0) / 14;
  for (const value of trueRanges.slice(14)) atr = (atr * 13 + value) / 14;
  const trend: "up" | "down" | "mixed" = last.close > fast && fast > slow ? "up" : last.close < fast && fast < slow ? "down" : "mixed";
  return {
    last, fast, slow, rsi: strength, atr, atrPercent: atr / last.close * 100, trend,
    support: Math.min(...recent.map((c) => c.low)),
    resistance: Math.max(...recent.map((c) => c.high)),
    momentum: (last.close / closes[closes.length - 21] - 1) * 100,
    count: candles.length,
  };
}

export function forecastCandles(candles: Candle[], horizon: number) {
  if (candles.length < 60 || !Number.isInteger(horizon) || horizon < 1 || horizon > 20) return null;
  const sample = candles.slice(-60);
  const returns = sample.slice(1).map((candle, i) => Math.log(candle.close / sample[i].close));
  const drift = returns.reduce((sum, n) => sum + n, 0) / returns.length;
  const variance = returns.reduce((sum, n) => sum + (n - drift) ** 2, 0) / (returns.length - 1);
  const sigma = Math.sqrt(variance);
  const last = sample[sample.length - 1].close;
  const points = Array.from({ length: horizon + 1 }, (_, step) => ({
    step,
    mid: last * Math.exp(drift * step),
    lower: last * Math.exp(drift * step - sigma * Math.sqrt(step)),
    upper: last * Math.exp(drift * step + sigma * Math.sqrt(step)),
  }));
  if (!points.every((point) => [point.mid, point.lower, point.upper].every(Number.isFinite))) return null;
  return { points, last, drift, sigma, sample: sample.length, target: points[horizon], history: sample.slice(-30).map((c) => c.close) };
}

export function marketComposition(symbols: MarketSymbol[], tickers: Record<string, MarketTicker>, mode: "assets" | "breadth") {
  const counts: Record<string, number> = mode === "assets"
    ? { crypto: 0, fx: 0, us_stocks: 0, idx_stocks: 0, other: 0 }
    : { up: 0, down: 0, flat: 0, missing: 0 };
  for (const symbol of new Map(symbols.map((item) => [item.id, item])).values()) {
    if (mode === "assets") {
      const kind = symbol.assetClass ?? (symbol.id.startsWith("ID:") ? "idx_stocks" : symbol.id.startsWith("US:") ? "us_stocks" : symbol.id.endsWith("USDT") ? "crypto" : "fx");
      counts[kind in counts ? kind : "other"]++;
    } else {
      const change = tickers[symbol.id]?.changePercent24h;
      counts[typeof change !== "number" || !Number.isFinite(change) ? "missing" : change > 0 ? "up" : change < 0 ? "down" : "flat"]++;
    }
  }
  return Object.entries(counts).map(([key, count]) => ({ key, count }));
}
