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
  if (!ts || isNaN(ts)) return "--:--:--";
  const d = new Date(ts);
  return d.toLocaleTimeString([], {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

/**
 * Convert UTC timestamp (milliseconds) to shifted seconds
 * matching the user's device local timezone for Lightweight Charts.
 * Lightweight Charts operates in UTC internally; shifting by the device's timezone
 * offset makes the chart's bottom axis and crosshair tooltips display the user's exact local time.
 */
export function toLocalChartTime(utcTimestampMs: number): number {
  const d = new Date(utcTimestampMs);
  const offsetSeconds = -d.getTimezoneOffset() * 60;
  return Math.floor(utcTimestampMs / 1000) + offsetSeconds;
}

/**
 * Formats user's local timezone offset (e.g. UTC+7)
 */
export function getDeviceTimezoneOffset(): string {
  try {
    const offsetMin = -new Date().getTimezoneOffset();
    const sign = offsetMin >= 0 ? "+" : "-";
    const hours = Math.floor(Math.abs(offsetMin) / 60);
    const mins = Math.abs(offsetMin) % 60;
    return mins > 0 ? `UTC${sign}${hours}:${mins}` : `UTC${sign}${hours}`;
  } catch {
    return "UTC";
  }
}

/**
 * Formats a date string into a human-readable relative time (e.g. "5m ago", "2h ago").
 */
export function timeAgo(dateStr: string): string {
  try {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  } catch {
    return "—";
  }
}
