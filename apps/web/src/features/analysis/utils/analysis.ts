import type { Candle, MarketSymbol, MarketTicker, Timeframe } from "@gorengan/shared";

export function cleanCandles(candles: Candle[], symbol: string, timeframe: Timeframe, now = Date.now()): Candle[] {
  const unique = new Map<number, Candle>();
  for (const candle of candles) {
    if (candle.symbol !== symbol || candle.timeframe !== timeframe || !candle.finalized || candle.synthetic) continue;
    if (![candle.openTime, candle.closeTime, candle.open, candle.high, candle.low, candle.close].every(Number.isFinite)) continue;
    if (candle.low <= 0 || candle.low > Math.min(candle.open, candle.close) || candle.high < Math.max(candle.open, candle.close)) continue;
    if (candle.openTime < 0 || candle.closeTime <= candle.openTime || candle.closeTime > now) continue;
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

export interface ForecastScenario {
  name: string;
  targetPrice: number;
  changePercent: number;
  weight: number;
  rationale: string;
}

export interface ForecastMetrics {
  parkinsonSigma: number;
  closeSigma: number;
  blendedSigma: number;
  drift: number;
  directionalAccuracy: number | null;
  evaluation: ForecastEvaluation;
  volatilityRegime: "COMPRESSION" | "NORMAL" | "EXPANSION";
  invalidationPrice: number;
  evRatio: number;
  pivotLevels: {
    pivot: number;
    r1: number;
    r2: number;
    s1: number;
    s2: number;
  };
}

export function forecastCandles(candles: Candle[], horizon: number) {
  if (candles.length < 60 || !Number.isInteger(horizon) || horizon < 1 || horizon > 20) return null;
  const sample = candles.slice(-60);
  const returns = sample.slice(1).map((candle, i) => Math.log(candle.close / sample[i].close));
  const drift = returns.reduce((sum, n) => sum + n, 0) / returns.length;
  const variance = returns.reduce((sum, n) => sum + (n - drift) ** 2, 0) / (returns.length - 1);
  const sigma = Math.sqrt(Math.max(0, variance));

  // Parkinson intraday range volatility
  const hlLogSq = sample.map((c) => (c.high > 0 && c.low > 0 ? Math.log(c.high / c.low) ** 2 : 0));
  const parkinsonVariance = hlLogSq.reduce((sum, v) => sum + v, 0) / (4 * Math.LN2 * sample.length);
  const parkinsonSigma = Math.sqrt(Math.max(0, parkinsonVariance));
  const blendedSigma = parkinsonSigma > 0 && sigma > 0 ? 0.6 * parkinsonSigma + 0.4 * sigma : sigma;

  const last = sample[sample.length - 1].close;

  // 1-sigma standard points (strictly matching existing contract)
  const points = Array.from({ length: horizon + 1 }, (_, step) => ({
    step,
    mid: last * Math.exp(drift * step),
    lower: last * Math.exp(drift * step - sigma * Math.sqrt(step)),
    upper: last * Math.exp(drift * step + sigma * Math.sqrt(step)),
  }));

  if (!points.every((point) => [point.mid, point.lower, point.upper].every((value) => Number.isFinite(value) && value > 0))) return null;

  // Two historical standard-deviation scenario envelopes, not calibrated probabilities.
  const points95 = Array.from({ length: horizon + 1 }, (_, step) => ({
    step,
    lower: last * Math.exp(drift * step - 2 * sigma * Math.sqrt(step)),
    upper: last * Math.exp(drift * step + 2 * sigma * Math.sqrt(step)),
  }));

  if (!points95.every((point) => [point.lower, point.upper].every((value) => Number.isFinite(value) && value > 0))) return null;

  const evaluation = evaluateForecast(candles, horizon);
  const directionalAccuracy = evaluation.directionalAccuracy;

  // Volatility regime classification
  const avgRange = sample.slice(-14).reduce((sum, c) => sum + (c.high - c.low), 0) / 14;
  const longRange = sample.reduce((sum, c) => sum + (c.high - c.low), 0) / sample.length;
  const volRatio = longRange > 0 ? avgRange / longRange : 1;
  const volatilityRegime: "COMPRESSION" | "NORMAL" | "EXPANSION" =
    volRatio < 0.75 ? "COMPRESSION" : volRatio > 1.35 ? "EXPANSION" : "NORMAL";

  // Classic pivot points from recent 20 bars
  const recent20 = sample.slice(-20);
  const high20 = Math.max(...recent20.map((c) => c.high));
  const low20 = Math.min(...recent20.map((c) => c.low));
  const pivot = (high20 + low20 + last) / 3;
  const r1 = 2 * pivot - low20;
  const r2 = pivot + (high20 - low20);
  const s1 = 2 * pivot - high20;
  const s2 = pivot - (high20 - low20);

  // Scenario modeling
  const closes = sample.map((c) => c.close);
  const fastEma = ema(closes, 20) ?? last;
  const slowEma = ema(closes, 50) ?? last;
  const strengthRsi = rsi(closes) ?? 50;

  let bullWeight = 33;
  let bearWeight = 33;
  if (last > fastEma && fastEma > slowEma) bullWeight += 18;
  else if (last < fastEma && fastEma < slowEma) bearWeight += 18;

  if (strengthRsi >= 50 && strengthRsi <= 68) bullWeight += 10;
  else if (strengthRsi > 70) bearWeight += 8; // overbought pullback risk
  else if (strengthRsi < 30) bullWeight += 10; // oversold bounce potential
  else if (strengthRsi < 45) bearWeight += 8;

  const totalWeight = bullWeight + bearWeight + 34;
  const bullProb = Math.round((bullWeight / totalWeight) * 100);
  const bearProb = Math.round((bearWeight / totalWeight) * 100);
  const baseProb = Math.max(10, 100 - bullProb - bearProb);

  const bullTarget = Math.max(points[horizon].mid, r1 > last ? r1 : points[horizon].upper);
  const bearTarget = Math.min(points[horizon].mid, s1 < last ? s1 : points[horizon].lower);
  const baseTarget = points[horizon].mid;

  const scenarios = {
    bull: {
      name: "Bullish Expansion",
      targetPrice: bullTarget,
      changePercent: ((bullTarget / last) - 1) * 100,
      weight: bullProb,
      rationale: "Momentum continuation testing overhead pivot resistance with positive volatility drift.",
    },
    base: {
      name: "Modal Equilibrium",
      targetPrice: baseTarget,
      changePercent: ((baseTarget / last) - 1) * 100,
      weight: baseProb,
      rationale: "Scenario following the recent mean log return; not a calibrated expected return.",
    },
    bear: {
      name: "Mean-Reverting Retracement",
      targetPrice: bearTarget,
      changePercent: ((bearTarget / last) - 1) * 100,
      weight: bearProb,
      rationale: "Pullback scenario towards key support S1 / EMA 50 discount baseline.",
    },
  };

  const invalidationPrice = last >= fastEma ? s1 : r1;
  const upside = Math.abs(bullTarget - last);
  const downside = Math.abs(last - bearTarget);
  const evRatio = downside > 0 ? (bullProb / 100 * upside) / (bearProb / 100 * downside) : 1;

  const metrics: ForecastMetrics = {
    parkinsonSigma,
    closeSigma: sigma,
    blendedSigma,
    drift,
    directionalAccuracy,
    volatilityRegime,
    evaluation,
    invalidationPrice,
    evRatio,
    pivotLevels: { pivot, r1, r2, s1, s2 },
  };

  return {
    points,
    points95,
    last,
    drift,
    sigma,
    sample: sample.length,
    target: points[horizon],
    history: sample.slice(-30).map((c) => c.close),
    scenarios,
    metrics,
  };
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


export interface ForecastEvaluation {
  samples: number;
  directionalSamples: number;
  directionalAccuracy: number | null;
  mape: number | null;
  baselineMape: number | null;
  envelopeCoverage: number | null;
  recentSamples: number;
  recentMape: number | null;
  recentBaselineMape: number | null;
}

// Each test trains on 60 preceding closes, then observes an unseen horizon.
// Advancing by the horizon prevents overlapping outcome windows.
export function evaluateForecast(candles: Candle[], horizon: number): ForecastEvaluation {
  const empty: ForecastEvaluation = { samples: 0, directionalSamples: 0, directionalAccuracy: null, mape: null, baselineMape: null, envelopeCoverage: null, recentSamples: 0, recentMape: null, recentBaselineMape: null };
  if (!Number.isInteger(horizon) || horizon < 1 || horizon > 20) return empty;
  let samples = 0, directionalSamples = 0, hits = 0, error = 0, baseline = 0, covered = 0;
  const errors: { model: number; baseline: number }[] = [];
  for (let end = 59; end + horizon < candles.length; end += horizon) {
    const train = candles.slice(end - 59, end + 1), actual = candles[end + horizon].close;
    if (!train.every((c) => Number.isFinite(c.close) && c.close > 0) || !Number.isFinite(actual) || actual <= 0) continue;
    const returns = train.slice(1).map((c, i) => Math.log(c.close / train[i].close));
    const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const sigma = Math.sqrt(returns.reduce((sum, r) => sum + (r - mean) ** 2, 0) / (returns.length - 1));
    const last = train[59].close, predicted = last * Math.exp(mean * horizon);
    const lower = last * Math.exp(mean * horizon - 2 * sigma * Math.sqrt(horizon));
    const upper = last * Math.exp(mean * horizon + 2 * sigma * Math.sqrt(horizon));
    if (![predicted, lower, upper].every(Number.isFinite)) continue;
    samples++;
    const modelError = Math.abs(predicted / actual - 1) * 100;
    const baselineError = Math.abs(last / actual - 1) * 100;
    errors.push({ model: modelError, baseline: baselineError });
    error += modelError;
    baseline += baselineError;
    if (actual >= lower && actual <= upper) covered++;
    if (Math.abs(predicted / last - 1) > 1e-10 && Math.abs(actual / last - 1) > 1e-10) {
      directionalSamples++;
      if (Math.sign(predicted - last) === Math.sign(actual - last)) hits++;
    }
  }
  const recent = errors.slice(-10);
  return { samples, directionalSamples, directionalAccuracy: directionalSamples ? hits / directionalSamples * 100 : null,
    mape: samples ? error / samples : null, baselineMape: samples ? baseline / samples : null,
    envelopeCoverage: samples ? covered / samples * 100 : null, recentSamples: recent.length,
    recentMape: recent.length ? recent.reduce((sum, row) => sum + row.model, 0) / recent.length : null,
    recentBaselineMape: recent.length ? recent.reduce((sum, row) => sum + row.baseline, 0) / recent.length : null };
}

export type ForecastBlockReason = "refresh_failed" | "stale" | "insufficient_tests" | "baseline" | "recent_baseline" | "direction" | "cost";
export function forecastEvidence(evaluation: ForecastEvaluation, projectedPercent: number, options: { fresh: boolean; refreshFailed: boolean; costBps: number }) {
  const reasons: ForecastBlockReason[] = [];
  if (options.refreshFailed) reasons.push("refresh_failed");
  if (!options.fresh) reasons.push("stale");
  if (!Number.isInteger(evaluation.samples) || !Number.isInteger(evaluation.directionalSamples) || evaluation.samples < 30 || evaluation.directionalSamples < 30 || evaluation.directionalSamples > evaluation.samples) reasons.push("insufficient_tests");
  const improvement = evaluation.baselineMape !== null && Number.isFinite(evaluation.baselineMape) && evaluation.baselineMape > 0 && evaluation.mape !== null && Number.isFinite(evaluation.mape) && evaluation.mape >= 0
    ? (1 - evaluation.mape / evaluation.baselineMape) * 100 : null;
  if (improvement === null || improvement < 10) reasons.push("baseline");
  if (evaluation.recentSamples !== 10 || evaluation.recentMape === null || !Number.isFinite(evaluation.recentMape) || evaluation.recentMape < 0 || evaluation.recentBaselineMape === null || !Number.isFinite(evaluation.recentBaselineMape) || evaluation.recentMape >= evaluation.recentBaselineMape) reasons.push("recent_baseline");
  if (evaluation.directionalAccuracy === null || !Number.isFinite(evaluation.directionalAccuracy) || evaluation.directionalAccuracy <= 50 || evaluation.directionalAccuracy > 100) reasons.push("direction");
  if (!Number.isFinite(projectedPercent) || !Number.isFinite(options.costBps) || options.costBps < 0 || Math.abs(projectedPercent) <= options.costBps / 100) reasons.push("cost");
  return { eligible: reasons.length === 0, reasons, improvementPercent: improvement };
}
