import { ColorType, type ChartOptions, type DeepPartial } from "lightweight-charts";

/* ─── Theme Colors ────────────────────────────────────────────────── */

export const CHART_COLORS = {
  background: "#2a2839",
  text: "#c8df79",
  grid: "rgba(85, 96, 126, 0.35)",
  crosshair: "rgba(244, 196, 27, 0.65)",
  crosshairLabel: "#55607e",
  border: "rgba(85, 96, 126, 0.7)",

  candleUp: "#3fdf97",
  candleDown: "#eb619f",
  volumeUp: "rgba(63, 223, 151, 0.35)",
  volumeDown: "rgba(235, 97, 159, 0.35)",

  ema20: "#f4c41b",
  ema50: "#c3e6eb",
} as const;

/* ─── Chart Options Factory ───────────────────────────────────────── */

export function createChartOptions(
  width: number,
  height: number,
  secondsVisible: boolean,
  terminalTheme = false
): DeepPartial<ChartOptions> {
  return {
    width,
    height,
    layout: {
      background: { type: ColorType.Solid, color: CHART_COLORS.background },
      textColor: terminalTheme ? "#c3e6eb" : CHART_COLORS.text,
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
