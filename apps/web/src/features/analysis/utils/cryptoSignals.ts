import type { Candle, Timeframe } from "@gorengan/shared";
import { analyzeCandles, cleanCandles } from "./analysis";

export function marketSignals(raw: Candle[], symbol: string, timeframe: Timeframe, now: number) {
  const candles = cleanCandles(raw, symbol, timeframe).filter((c) => c.closeTime <= now && c.openTime < c.closeTime);
  const analysis = analyzeCandles(candles);
  if (!analysis) return null;
  const previous = candles.slice(-21, -1);
  const volumes = previous.map((c) => c.volume);
  const volumeValid = [...volumes, analysis.last.volume].every((v) => Number.isFinite(v) && v >= 0);
  const mean = volumes.reduce((sum, v) => sum + v, 0) / 20;
  const relativeVolume = volumeValid && mean > 0 ? analysis.last.volume / mean : null;
  const priorHigh = Math.max(...previous.map((c) => c.high));
  const priorLow = Math.min(...previous.map((c) => c.low));
  return { ...analysis, relativeVolume, priorHigh, priorLow,
    breakout: analysis.last.close > priorHigh,
    breakdown: analysis.last.close < priorLow,
    volumeConfirmed: relativeVolume !== null && relativeVolume >= 2,
    extended: analysis.rsi >= 70 || (analysis.atr > 0 && analysis.last.close - analysis.fast > 2 * analysis.atr),
  };
}

export interface RiskInput {
  capital: number; riskPercent: number; entry: number; stop: number; target: number;
  feePercent: number; slippagePercent: number; lotSize: number;
}

export function positionPlan(input: RiskInput) {
  const { capital, riskPercent, entry, stop, target, feePercent, slippagePercent, lotSize } = input;
  if (!Object.values(input).every(Number.isFinite) || capital <= 0 || riskPercent <= 0 || riskPercent > 100 || stop <= 0 || stop >= entry || target <= entry || feePercent < 0 || slippagePercent < 0 || feePercent + slippagePercent >= 100 || lotSize <= 0) return null;
  const fee = feePercent / 100;
  const slip = slippagePercent / 100;
  const cost = entry * (1 + slip) * (1 + fee);
  const stopProceeds = stop * (1 - slip) * (1 - fee);
  const targetProceeds = target * (1 - slip) * (1 - fee);
  const riskBudget = capital * riskPercent / 100;
  const quantity = Math.floor(Math.min(riskBudget / (cost - stopProceeds), capital / cost) / lotSize) * lotSize;
  const result = { quantity, lots: quantity / lotSize, riskBudget, capitalUsed: quantity * cost,
    plannedLoss: quantity * (cost - stopProceeds), plannedProfit: quantity * (targetProceeds - cost),
    rewardRisk: (targetProceeds - cost) / (cost - stopProceeds), breakEven: cost / ((1 - slip) * (1 - fee)) };
  return Object.values(result).every(Number.isFinite) ? result : null;
}
