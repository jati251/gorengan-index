import { ColorType, type ChartOptions, type DeepPartial } from "lightweight-charts";

/* ─── Theme Colors ────────────────────────────────────────────────── */

export const CHART_COLORS = {
  background: "#070a13",
  text: "#64748b",
  grid: "rgba(30, 41, 59, 0.3)",
  crosshair: "rgba(100, 116, 139, 0.6)",
  crosshairLabel: "#1e293b",
  border: "rgba(30, 41, 59, 0.8)",

  candleUp: "#10b981",
  candleDown: "#f43f5e",
  volumeUp: "rgba(16, 185, 129, 0.45)",
  volumeDown: "rgba(244, 63, 94, 0.45)",

  ema20: "#06b6d4",
  ema50: "#f59e0b",
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
