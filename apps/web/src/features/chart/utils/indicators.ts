import type { LineData, Time } from "lightweight-charts";

/**
 * Calculate Exponential Moving Average (EMA) from close-price time series.
 * Returns an empty array if there are fewer data points than the period.
 */
export function calculateEMA(
  data: { time: Time; close: number }[],
  period: number
): LineData<Time>[] {
  if (data.length < period) return [];

  const k = 2 / (period + 1);
  const result: LineData<Time>[] = [];

  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += data[i].close;
  }
  let ema = sum / period;
  result.push({ time: data[period - 1].time, value: ema });

  for (let i = period; i < data.length; i++) {
    ema = data[i].close * k + ema * (1 - k);
    result.push({ time: data[i].time, value: ema });
  }

  return result;
}
