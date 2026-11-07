import { FX_PAIRS } from "./fxPairs";

const fxNumberFormatters = new Map<number, Intl.NumberFormat>();

function getFxFormatter(decimals: number): Intl.NumberFormat {
  const safeDecimals = Math.max(0, Math.min(10, decimals));
  let fmt = fxNumberFormatters.get(safeDecimals);
  if (!fmt) {
    fmt = new Intl.NumberFormat("en-US", {
      minimumFractionDigits: safeDecimals,
      maximumFractionDigits: safeDecimals,
    });
    fxNumberFormatters.set(safeDecimals, fmt);
  }
  return fmt;
}

function getFxDecimals(customDecimals?: number, symbol?: string): number {
  if (customDecimals !== undefined) return customDecimals;
  if (symbol && FX_PAIRS[symbol]) return FX_PAIRS[symbol].displayDecimals;
  return 5;
}

export function formatFxPrice(
  price: number | undefined,
  symbol?: string,
  customDecimals?: number
): string {
  if (price === undefined || Number.isNaN(price)) return "—";

  const decimals = getFxDecimals(customDecimals, symbol);
  return getFxFormatter(decimals).format(price);
}

export function formatPips(
  spread: number | undefined,
  pipSize: number | undefined = 0.0001
): string {
  if (spread === undefined || isNaN(spread) || !pipSize) return "—";
  const pips = spread / pipSize;
  return `${(Math.round(pips * 10) / 10).toFixed(1)} pip`;
}
