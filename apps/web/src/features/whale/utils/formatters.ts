import type { WhaleCategory } from "../types";

export function formatBtc(amount: number | null | undefined, decimals = 2): string {
  if (amount == null || !Number.isFinite(amount)) return "— BTC";
  return `${amount.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })} BTC`;
}

export function formatUsd(amount: number | null | undefined, compact = false): string {
  if (amount == null || !Number.isFinite(amount)) return "—";
  if (compact) {
    if (Math.abs(amount) >= 1_000_000_000) {
      return `$${(amount / 1_000_000_000).toFixed(2)}B`;
    }
    if (Math.abs(amount) >= 1_000_000) {
      return `$${(amount / 1_000_000).toFixed(2)}M`;
    }
    if (Math.abs(amount) >= 1_000) {
      return `$${(amount / 1_000).toFixed(1)}K`;
    }
  }
  return `$${amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatFlow(amount: number | null | undefined): string {
  if (amount == null || !Number.isFinite(amount)) return "—";
  const prefix = amount > 0 ? "+$" : amount < 0 ? "-$" : "$";
  const abs = Math.abs(amount);
  return `${prefix}${abs.toFixed(1)}M`;
}

export function formatPercent(pct: number | null | undefined, includeSign = true): string {
  if (pct == null || !Number.isFinite(pct)) return "—%";
  const sign = includeSign && pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(2)}%`;
}

export function getWhaleCategoryBadge(category: WhaleCategory, isId: boolean): { label: string; bg: string; text: string; border: string } {
  switch (category) {
    case "INSTITUTION":
      return {
        label: isId ? "Institusi ETF" : "Institutional ETF",
        bg: "bg-blue-500/10",
        text: "text-blue-400",
        border: "border-blue-500/20",
      };
    case "CORPORATE":
      return {
        label: isId ? "Treasury Korporasi" : "Corporate Treasury",
        bg: "bg-purple-500/10",
        text: "text-purple-400",
        border: "border-purple-500/20",
      };
    case "EXCHANGE":
      return {
        label: isId ? "Cold Wallet Bursa" : "Exchange Cold Wallet",
        bg: "bg-amber-500/10",
        text: "text-amber-400",
        border: "border-amber-500/20",
      };
    case "GOVERNMENT":
      return {
        label: isId ? "Sovereign / Sitaan Negara" : "Gov / Seized Funds",
        bg: "bg-red-500/10",
        text: "text-red-400",
        border: "border-red-500/20",
      };
    case "FOUNDER":
      return {
        label: isId ? "Genesis / Satoshi" : "Genesis / Founder",
        bg: "bg-emerald-500/10",
        text: "text-emerald-400",
        border: "border-emerald-500/20",
      };
  }
}

export function getSignalBadge(signal: string, isId: boolean): { label: string; color: string; desc: string } {
  switch (signal) {
    case "STRONG_BUY":
      return {
        label: isId ? "AKUMULASI MASIF" : "MASSIVE ACCUMULATION",
        color: "text-emerald-400 bg-emerald-500/15 border-emerald-500/30",
        desc: isId ? "Arus masuk ETF & Whale sangat agresif dalam 5 hari terakhir." : "ETF & Whale net inflows highly aggressive in the last 5 days.",
      };
    case "ACCUMULATION":
      return {
        label: isId ? "NET ACCUMULATION" : "NET ACCUMULATION",
        color: "text-emerald-300 bg-emerald-500/10 border-emerald-500/20",
        desc: isId ? "Dominasi inflow institusional melebihi tekanan jual bursa." : "Institutional inflow exceeds exchange sell pressure.",
      };
    case "DISTRIBUTION":
      return {
        label: isId ? "DISTRIBUSI / PROFIT TAKING" : "DISTRIBUTION",
        color: "text-rose-400 bg-rose-500/15 border-rose-500/30",
        desc: isId ? "Terdeteksi outflow spot ETF atau transfer whale ke bursa." : "Spot ETF outflows or whale deposits to exchanges detected.",
      };
    default:
      return {
        label: isId ? "NETRAL / KONSOLIDASI" : "NEUTRAL / BALANCED",
        color: "text-zinc-300 bg-zinc-500/10 border-zinc-500/20",
        desc: isId ? "Arus modal masuk dan keluar seimbang." : "Capital inflows and outflows are balanced.",
      };
  }
}
