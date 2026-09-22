import type { EquityMetadata } from "../types";

export const EQUITY_UNIVERSE: Record<string, EquityMetadata> = {
  // US Equities (IEX realtime venue)
  "US:AAPL": {
    id: "US:AAPL",
    symbol: "AAPL",
    name: "Apple Inc.",
    exchange: "NASDAQ",
    country: "US",
    currency: "USD",
    flag: "🇺🇸",
    defaultDataQuality: "realtime_venue",
  },
  "US:MSFT": {
    id: "US:MSFT",
    symbol: "MSFT",
    name: "Microsoft Corporation",
    exchange: "NASDAQ",
    country: "US",
    currency: "USD",
    flag: "🇺🇸",
    defaultDataQuality: "realtime_venue",
  },
  "US:NVDA": {
    id: "US:NVDA",
    symbol: "NVDA",
    name: "NVIDIA Corporation",
    exchange: "NASDAQ",
    country: "US",
    currency: "USD",
    flag: "🇺🇸",
    defaultDataQuality: "realtime_venue",
  },
  "US:TSLA": {
    id: "US:TSLA",
    symbol: "TSLA",
    name: "Tesla, Inc.",
    exchange: "NASDAQ",
    country: "US",
    currency: "USD",
    flag: "🇺🇸",
    defaultDataQuality: "realtime_venue",
  },
  "US:AMZN": {
    id: "US:AMZN",
    symbol: "AMZN",
    name: "Amazon.com, Inc.",
    exchange: "NASDAQ",
    country: "US",
    currency: "USD",
    flag: "🇺🇸",
    defaultDataQuality: "realtime_venue",
  },
  "US:META": {
    id: "US:META",
    symbol: "META",
    name: "Meta Platforms, Inc.",
    exchange: "NASDAQ",
    country: "US",
    currency: "USD",
    flag: "🇺🇸",
    defaultDataQuality: "realtime_venue",
  },
  "US:GOOGL": {
    id: "US:GOOGL",
    symbol: "GOOGL",
    name: "Alphabet Inc.",
    exchange: "NASDAQ",
    country: "US",
    currency: "USD",
    flag: "🇺🇸",
    defaultDataQuality: "realtime_venue",
  },
  "US:AMD": {
    id: "US:AMD",
    symbol: "AMD",
    name: "Advanced Micro Devices",
    exchange: "NASDAQ",
    country: "US",
    currency: "USD",
    flag: "🇺🇸",
    defaultDataQuality: "realtime_venue",
  },
  "US:SPY": {
    id: "US:SPY",
    symbol: "SPY",
    name: "SPDR S&P 500 ETF Trust",
    exchange: "NYSE Arca",
    country: "US",
    currency: "USD",
    flag: "🇺🇸",
    defaultDataQuality: "realtime_venue",
  },
  "US:QQQ": {
    id: "US:QQQ",
    symbol: "QQQ",
    name: "Invesco QQQ Trust",
    exchange: "NASDAQ",
    country: "US",
    currency: "USD",
    flag: "🇺🇸",
    defaultDataQuality: "realtime_venue",
  },

  // IDX Equities (Indonesia stock exchange - delayed feed)
  "ID:BBCA": {
    id: "ID:BBCA",
    symbol: "BBCA",
    name: "Bank Central Asia Tbk",
    exchange: "IDX",
    country: "ID",
    currency: "IDR",
    flag: "🇮🇩",
    defaultDataQuality: "delayed",
  },
  "ID:BBRI": {
    id: "ID:BBRI",
    symbol: "BBRI",
    name: "Bank Rakyat Indonesia Tbk",
    exchange: "IDX",
    country: "ID",
    currency: "IDR",
    flag: "🇮🇩",
    defaultDataQuality: "delayed",
  },
  "ID:BMRI": {
    id: "ID:BMRI",
    symbol: "BMRI",
    name: "Bank Mandiri (Persero) Tbk",
    exchange: "IDX",
    country: "ID",
    currency: "IDR",
    flag: "🇮🇩",
    defaultDataQuality: "delayed",
  },
  "ID:BBNI": {
    id: "ID:BBNI",
    symbol: "BBNI",
    name: "Bank Negara Indonesia Tbk",
    exchange: "IDX",
    country: "ID",
    currency: "IDR",
    flag: "🇮🇩",
    defaultDataQuality: "delayed",
  },
  "ID:TLKM": {
    id: "ID:TLKM",
    symbol: "TLKM",
    name: "Telkom Indonesia Tbk",
    exchange: "IDX",
    country: "ID",
    currency: "IDR",
    flag: "🇮🇩",
    defaultDataQuality: "delayed",
  },
  "ID:ASII": {
    id: "ID:ASII",
    symbol: "ASII",
    name: "Astra International Tbk",
    exchange: "IDX",
    country: "ID",
    currency: "IDR",
    flag: "🇮🇩",
    defaultDataQuality: "delayed",
  },
  "ID:ANTM": {
    id: "ID:ANTM",
    symbol: "ANTM",
    name: "Aneka Tambang Tbk",
    exchange: "IDX",
    country: "ID",
    currency: "IDR",
    flag: "🇮🇩",
    defaultDataQuality: "delayed",
  },
  "ID:GOTO": {
    id: "ID:GOTO",
    symbol: "GOTO",
    name: "GoTo Gojek Tokopedia Tbk",
    exchange: "IDX",
    country: "ID",
    currency: "IDR",
    flag: "🇮🇩",
    defaultDataQuality: "delayed",
  },
};

export function isEquitySymbol(symbol: string): boolean {
  return symbol.startsWith("US:") || symbol.startsWith("ID:") || symbol in EQUITY_UNIVERSE;
}

export function isUsEquitySymbol(symbol: string): boolean {
  return symbol.startsWith("US:") || EQUITY_UNIVERSE[symbol]?.country === "US";
}

export function isIdxEquitySymbol(symbol: string): boolean {
  return symbol.startsWith("ID:") || EQUITY_UNIVERSE[symbol]?.country === "ID";
}

export function getEquityMetadata(symbol: string): EquityMetadata | undefined {
  if (EQUITY_UNIVERSE[symbol]) {
    return EQUITY_UNIVERSE[symbol];
  }

  if (symbol.startsWith("US:")) {
    const raw = symbol.slice(3);
    return {
      id: symbol,
      symbol: raw,
      name: `${raw} Equity`,
      exchange: "US",
      country: "US",
      currency: "USD",
      flag: "🇺🇸",
      defaultDataQuality: "realtime_venue",
    };
  }

  if (symbol.startsWith("ID:")) {
    const raw = symbol.slice(3);
    return {
      id: symbol,
      symbol: raw,
      name: `${raw} Equity`,
      exchange: "IDX",
      country: "ID",
      currency: "IDR",
      flag: "🇮🇩",
      defaultDataQuality: "delayed",
    };
  }

  return undefined;
}
