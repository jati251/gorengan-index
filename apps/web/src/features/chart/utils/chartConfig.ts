import { ColorType, type ChartOptions, type DeepPartial } from "lightweight-charts";

/* ─── Theme Colors ────────────────────────────────────────────────── */

export const CHART_COLORS = {
  background: "#10251b",
  text: "#b3c6ad",
  grid: "rgba(166, 192, 157, 0.10)",
  crosshair: "rgba(221, 181, 113, 0.55)",
  crosshairLabel: "#34503a",
  border: "rgba(166, 192, 157, 0.30)",

  candleUp: "#10b981",
  candleDown: "#f43f5e",
  volumeUp: "rgba(16, 185, 129, 0.45)",
  volumeDown: "rgba(244, 63, 94, 0.45)",

  ema20: "#d4a060",
  ema50: "#dfd6b2",
} as const;

/* ─── Chart Options Factory ───────────────────────────────────────── */

export function createChartOptions(
  width: number,
  height: number,
  secondsVisible: boolean
): DeepPartial<ChartOptions> {
  return {
    width,
    height,
    layout: {
      background: { type: ColorType.Solid, color: CHART_COLORS.background },
      textColor: CHART_COLORS.text,
      fontFamily: "monospace",
      fontSize: 11,
    },
    grid: {
      vertLines: { color: CHART_COLORS.grid },
      horzLines: { color: CHART_COLORS.grid },
    },
    crosshair: {
      vertLine: {
        color: CHART_COLORS.crosshair,
        width: 1,
        style: 3,
        labelBackgroundColor: CHART_COLORS.crosshairLabel,
      },
      horzLine: {
        color: CHART_COLORS.crosshair,
        width: 1,
        style: 3,
        labelBackgroundColor: CHART_COLORS.crosshairLabel,
      },
    },
    rightPriceScale: {
      borderColor: CHART_COLORS.border,
      scaleMargins: { top: 0.1, bottom: 0.22 },
    },
    timeScale: {
      borderColor: CHART_COLORS.border,
      timeVisible: true,
      secondsVisible,
      barSpacing: 9,
      minBarSpacing: 3,
      rightOffset: 12,
    },
  };
}

/* ─── Sub-minute Timeframes ───────────────────────────────────────── */

const SUB_MINUTE_TIMEFRAMES = new Set(["1s", "5s", "15s", "30s"]);

export function isSubMinuteTimeframe(timeframe: string): boolean {
  return SUB_MINUTE_TIMEFRAMES.has(timeframe);
}
