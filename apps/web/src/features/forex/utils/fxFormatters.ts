import { FX_PAIRS } from "./fxPairs";

export function formatFxPrice(
  price: number | undefined,
  symbol?: string,
  customDecimals?: number
): string {
  if (price === undefined || isNaN(price)) return "—";

  const decimals =
    customDecimals !== undefined
      ? customDecimals
      : symbol && FX_PAIRS[symbol]
        ? FX_PAIRS[symbol].displayDecimals
        : 5;

  return price.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function formatPips(
  spread: number | undefined,
  pipSize: number | undefined = 0.0001
): string {
  if (spread === undefined || isNaN(spread) || !pipSize) return "—";
  const pips = spread / pipSize;
  return `${(Math.round(pips * 10) / 10).toFixed(1)} pip`;
}
