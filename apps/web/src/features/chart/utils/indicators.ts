import type { LineData, Time } from "lightweight-charts";

export interface EmaIncrementalState {
  period: number;
  k: number;
  /** EMA of the bar immediately preceding `lastTime` */
  prevBarEma: number | null;
  /** Latest computed EMA at `lastTime` */
  currentBarEma: number | null;
  /** Timestamp (numeric seconds) of the latest bar */
  lastTime: number | null;
}

/**
 * Calculate Exponential Moving Average (EMA) from close-price time series,
 * returning both the line series points and the O(1) incremental state for live streaming ticks.
 */
export function calculateEMAWithState(
  data: { time: Time; close: number }[],
  period: number
): { points: LineData<Time>[]; state: EmaIncrementalState } {
  const k = 2 / (period + 1);
  if (data.length < period) {
    return {
      points: [],
      state: {
        period,
        k,
        prevBarEma: null,
        currentBarEma: null,
        lastTime: null,
      },
    };
  }

  const len = data.length - period + 1;
  const result: LineData<Time>[] = new Array(len);

  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += data[i].close;
  }
  let ema = sum / period;
  let prevBarEma = ema;
  result[0] = { time: data[period - 1].time, value: ema };

  for (let i = period; i < data.length; i++) {
    prevBarEma = ema;
    ema = data[i].close * k + ema * (1 - k);
    result[i - period + 1] = { time: data[i].time, value: ema };
  }

  return {
    points: result,
    state: {
      period,
      k,
      prevBarEma,
      currentBarEma: ema,
      lastTime: Number(data[data.length - 1].time),
    },
  };
}

/**
 * Update EMA in O(1) time for a live tick or newly opened candle bar.
 */
export function stepIncrementalEMA(
  state: EmaIncrementalState,
  time: Time,
  close: number
): LineData<Time> | null {
  if (state.currentBarEma === null || state.prevBarEma === null || state.lastTime === null) {
    return null;
  }

  const timeNum = Number(time);
  if (timeNum < state.lastTime) {
    return null;
  }

  if (timeNum > state.lastTime) {
    state.prevBarEma = state.currentBarEma;
    state.lastTime = timeNum;
  }

  const nextEma = close * state.k + state.prevBarEma * (1 - state.k);
  state.currentBarEma = nextEma;
  return { time, value: nextEma };
}

/**
 * Calculate Exponential Moving Average (EMA) from close-price time series.
 * Returns an empty array if there are fewer data points than the period.
 */
export function calculateEMA(
  data: { time: Time; close: number }[],
  period: number
): LineData<Time>[] {
  return calculateEMAWithState(data, period).points;
}
