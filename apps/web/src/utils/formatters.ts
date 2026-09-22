export function formatPrice(
  price: number | undefined | null,
  minDecimals = 2,
  maxDecimals = 4
): string {
  if (price === undefined || price === null || isNaN(price)) return "—";

  // For very small numbers (e.g. XRP or meme tokens), show more decimals
  if (price < 1 && price > 0) {
    minDecimals = 4;
    maxDecimals = 6;
  }

  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: minDecimals,
    maximumFractionDigits: maxDecimals,
  }).format(price);
}

export function formatPercent(percent: number | undefined | null): string {
  if (percent === undefined || percent === null || isNaN(percent)) return "0.00%";
  const sign = percent > 0 ? "+" : "";
  return `${sign}${percent.toFixed(2)}%`;
}

export function formatVolume(volume: number | undefined | null): string {
  if (volume === undefined || volume === null || isNaN(volume)) return "0";
  if (volume >= 1e9) {
    return `${(volume / 1e9).toFixed(2)}B`;
  }
  if (volume >= 1e6) {
    return `${(volume / 1e6).toFixed(2)}M`;
  }
  if (volume >= 1e3) {
    return `${(volume / 1e3).toFixed(2)}K`;
  }
  return volume.toFixed(2);
}

export function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}
