import { isIdxEquitySymbol } from "./equityPairs";

export function formatEquityPrice(
  price: number | undefined,
  symbol?: string,
  currency?: string
): string {
  if (price === undefined || isNaN(price)) return "—";

  const isId = currency === "IDR" || (symbol ? isIdxEquitySymbol(symbol) : false);

  if (isId) {
    return `Rp ${Math.round(price).toLocaleString("id-ID")}`;
  }

  // Default US Equity format
  return `$${price.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatEquityVolume(volume: number | undefined): string {
  if (volume === undefined || isNaN(volume)) return "—";
  if (volume >= 1_000_000_000) return `${(volume / 1_000_000_000).toFixed(2)}B`;
  if (volume >= 1_000_000) return `${(volume / 1_000_000).toFixed(2)}M`;
  if (volume >= 1_000) return `${(volume / 1_000).toFixed(1)}K`;
  return volume.toLocaleString("en-US");
}

export function getSessionBadgeInfo(
  sessionState?: string,
  dataQuality?: string,
  isUs?: boolean,
  locale: "en" | "id" = "en"
): { label: string; colorClass: string; isLive: boolean } {
  const normState = sessionState?.toLowerCase() ?? "closed";
  const isId = locale === "id";

  if (normState === "closed") {
    return {
      label: isId ? "TUTUP" : "CLOSED",
      colorClass: "bg-slate-800 text-slate-400 border-slate-700/60",
      isLive: false,
    };
  }

  if (normState === "holiday") {
    return {
      label: isId ? "LIBUR" : "HOLIDAY",
      colorClass: "bg-amber-950/70 text-amber-400 border-amber-800/50",
      isLive: false,
    };
  }

  if (normState === "break") {
    return {
      label: isId ? "ISTIRAHAT" : "BREAK",
      colorClass: "bg-amber-950/60 text-amber-300 border-amber-700/50",
      isLive: false,
    };
  }

  if (normState === "pre_market" || normState === "premarket") {
    return {
      label: isId ? "PRA-PASAR" : "PRE-MARKET",
      colorClass: "bg-purple-950/70 text-purple-400 border-purple-800/50",
      isLive: true,
    };
  }

  if (normState === "after_hours" || normState === "afterhours") {
    return {
      label: isId ? "PASCA-PASAR" : "AFTER-HOURS",
      colorClass: "bg-indigo-950/70 text-indigo-400 border-indigo-800/50",
      isLive: true,
    };
  }

  // Active / regular session
  if (isUs) {
    return {
      label: "LIVE · IEX",
      colorClass: "bg-emerald-950/80 text-emerald-400 border-emerald-800/60 animate-pulse",
      isLive: true,
    };
  }

  return {
    label: isId ? "DELAY" : "DELAYED",
    colorClass: "bg-sky-950/70 text-sky-400 border-sky-800/50",
    isLive: true,
  };
}
