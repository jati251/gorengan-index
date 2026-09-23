import type { CandlePriceBasis, MarketSessionState } from "./quote.js";

export type AssetClass = "crypto" | "metal" | "fx" | "equity" | "etf" | "us_stocks" | "idx_stocks";

export interface MarketSymbol {
  id: string; // Canonical identifier e.g. "BTC-USDT", "EUR-USD", "US:AAPL", "ID:BBCA"
  base: string; // "BTC", "EUR", "AAPL", "BBCA"
  quote: string; // "USDT", "USD", "IDR"
  assetClass: AssetClass;
  provider: string; // "binance", "yahoo", "interbank", "alpaca_iex", "idx_delayed"
  providerSymbol: string; // "BTCUSDT", "EURUSD=X", "AAPL", "BBCA.JK"
  name: string; // "Bitcoin", "Apple Inc.", "Bank Central Asia"
  enabled: boolean;
  isTokenizedMetal?: boolean; // True for PAXG/XAUT (tokenized gold per architecture specification)
  pipSize?: number; // e.g. 0.0001 for EUR/USD, 0.01 for USD/JPY
  displayDecimals?: number; // e.g. 5 for EUR/USD, 3 for USD/JPY, 2 for US, 0 for IDX
  candlePriceBasis?: CandlePriceBasis; // "mid" for FX, "trade" for crypto/equities
  sessionState?: MarketSessionState;
  exchange?: string; // "NASDAQ", "NYSE", "IDX"
  country?: "US" | "ID";
  timezone?: string; // "America/New_York", "Asia/Jakarta"
}

/**
 * Benchmark fallback symbols for fast offline startup and initial SSR rendering.
 * The full universe of 460+ symbols is loaded dynamically from PostgreSQL / API.
 */
export const DEFAULT_CRYPTO_SYMBOLS: MarketSymbol[] = [
  {
    "id": "BTC-USDT",
    "base": "BTC",
    "quote": "USDT",
    "assetClass": "crypto",
    "provider": "binance",
    "providerSymbol": "BTCUSDT",
    "name": "Bitcoin",
    "enabled": true,
    "displayDecimals": 2,
    "candlePriceBasis": "trade"
  },
  {
    "id": "ETH-USDT",
    "base": "ETH",
    "quote": "USDT",
    "assetClass": "crypto",
    "provider": "binance",
    "providerSymbol": "ETHUSDT",
    "name": "Ethereum",
    "enabled": true,
    "displayDecimals": 2,
    "candlePriceBasis": "trade"
  },
  {
    "id": "SOL-USDT",
    "base": "SOL",
    "quote": "USDT",
    "assetClass": "crypto",
    "provider": "binance",
    "providerSymbol": "SOLUSDT",
    "name": "Solana",
    "enabled": true,
    "displayDecimals": 2,
    "candlePriceBasis": "trade"
  },
  {
    "id": "BNB-USDT",
    "base": "BNB",
    "quote": "USDT",
    "assetClass": "crypto",
    "provider": "binance",
    "providerSymbol": "BNBUSDT",
    "name": "BNB",
    "enabled": true,
    "displayDecimals": 2,
    "candlePriceBasis": "trade"
  },
  {
    "id": "XRP-USDT",
    "base": "XRP",
    "quote": "USDT",
    "assetClass": "crypto",
    "provider": "binance",
    "providerSymbol": "XRPUSDT",
    "name": "XRP",
    "enabled": true,
    "displayDecimals": 4,
    "candlePriceBasis": "trade"
  },
  {
    "id": "DOGE-USDT",
    "base": "DOGE",
    "quote": "USDT",
    "assetClass": "crypto",
    "provider": "binance",
    "providerSymbol": "DOGEUSDT",
    "name": "Dogecoin",
    "enabled": true,
    "displayDecimals": 4,
    "candlePriceBasis": "trade"
  },
  {
    "id": "ADA-USDT",
    "base": "ADA",
    "quote": "USDT",
    "assetClass": "crypto",
    "provider": "binance",
    "providerSymbol": "ADAUSDT",
    "name": "Cardano",
    "enabled": true,
    "displayDecimals": 4,
    "candlePriceBasis": "trade"
  },
  {
    "id": "AVAX-USDT",
    "base": "AVAX",
    "quote": "USDT",
    "assetClass": "crypto",
    "provider": "binance",
    "providerSymbol": "AVAXUSDT",
    "name": "Avalanche",
    "enabled": true,
    "displayDecimals": 2,
    "candlePriceBasis": "trade"
  },
  {
    "id": "LINK-USDT",
    "base": "LINK",
    "quote": "USDT",
    "assetClass": "crypto",
    "provider": "binance",
    "providerSymbol": "LINKUSDT",
    "name": "Chainlink",
    "enabled": true,
    "displayDecimals": 2,
    "candlePriceBasis": "trade"
  },
  {
    "id": "SUI-USDT",
    "base": "SUI",
    "quote": "USDT",
    "assetClass": "crypto",
    "provider": "binance",
    "providerSymbol": "SUIUSDT",
    "name": "Sui",
    "enabled": true,
    "displayDecimals": 4,
    "candlePriceBasis": "trade"
  },
  {
    "id": "NEAR-USDT",
    "base": "NEAR",
    "quote": "USDT",
    "assetClass": "crypto",
    "provider": "binance",
    "providerSymbol": "NEARUSDT",
    "name": "NEAR Protocol",
    "enabled": true,
    "displayDecimals": 3,
    "candlePriceBasis": "trade"
  },
  {
    "id": "PEPE-USDT",
    "base": "PEPE",
    "quote": "USDT",
    "assetClass": "crypto",
    "provider": "binance",
    "providerSymbol": "PEPEUSDT",
    "name": "Pepe",
    "enabled": true,
    "displayDecimals": 8,
    "candlePriceBasis": "trade"
  },
  {
    "id": "SHIB-USDT",
    "base": "SHIB",
    "quote": "USDT",
    "assetClass": "crypto",
    "provider": "binance",
    "providerSymbol": "SHIBUSDT",
    "name": "Shiba Inu",
    "enabled": true,
    "displayDecimals": 8,
    "candlePriceBasis": "trade"
  },
  {
    "id": "DOT-USDT",
    "base": "DOT",
    "quote": "USDT",
    "assetClass": "crypto",
    "provider": "binance",
    "providerSymbol": "DOTUSDT",
    "name": "Polkadot",
    "enabled": true,
    "displayDecimals": 3,
    "candlePriceBasis": "trade"
  },
  {
    "id": "LTC-USDT",
    "base": "LTC",
    "quote": "USDT",
    "assetClass": "crypto",
    "provider": "binance",
    "providerSymbol": "LTCUSDT",
    "name": "Litecoin",
    "enabled": true,
    "displayDecimals": 2,
    "candlePriceBasis": "trade"
  },
  {
    "id": "PAXG-USDT",
    "base": "PAXG",
    "quote": "USDT",
    "assetClass": "metal",
    "provider": "binance",
    "providerSymbol": "PAXGUSDT",
    "name": "Paxos Gold (Tokenized Gold)",
    "enabled": true,
    "isTokenizedMetal": true,
    "displayDecimals": 2,
    "candlePriceBasis": "trade"
  }
];

export const DEFAULT_FX_SYMBOLS: MarketSymbol[] = [
  {
    "id": "EUR-USD",
    "base": "EUR",
    "quote": "USD",
    "assetClass": "fx",
    "provider": "interbank",
    "providerSymbol": "EURUSD=X",
    "name": "Euro / US Dollar",
    "enabled": true,
    "pipSize": 0.0001,
    "displayDecimals": 5,
    "candlePriceBasis": "mid"
  },
  {
    "id": "GBP-USD",
    "base": "GBP",
    "quote": "USD",
    "assetClass": "fx",
    "provider": "interbank",
    "providerSymbol": "GBPUSD=X",
    "name": "British Pound / US Dollar",
    "enabled": true,
    "pipSize": 0.0001,
    "displayDecimals": 5,
    "candlePriceBasis": "mid"
  },
  {
    "id": "USD-JPY",
    "base": "USD",
    "quote": "JPY",
    "assetClass": "fx",
    "provider": "interbank",
    "providerSymbol": "USDJPY=X",
    "name": "US Dollar / Japanese Yen",
    "enabled": true,
    "pipSize": 0.01,
    "displayDecimals": 3,
    "candlePriceBasis": "mid"
  },
  {
    "id": "AUD-USD",
    "base": "AUD",
    "quote": "USD",
    "assetClass": "fx",
    "provider": "interbank",
    "providerSymbol": "AUDUSD=X",
    "name": "Australian Dollar / US Dollar",
    "enabled": true,
    "pipSize": 0.0001,
    "displayDecimals": 5,
    "candlePriceBasis": "mid"
  },
  {
    "id": "USD-CAD",
    "base": "USD",
    "quote": "CAD",
    "assetClass": "fx",
    "provider": "interbank",
    "providerSymbol": "USDCAD=X",
    "name": "US Dollar / Canadian Dollar",
    "enabled": true,
    "pipSize": 0.0001,
    "displayDecimals": 5,
    "candlePriceBasis": "mid"
  },
  {
    "id": "USD-CHF",
    "base": "USD",
    "quote": "CHF",
    "assetClass": "fx",
    "provider": "interbank",
    "providerSymbol": "USDCHF=X",
    "name": "US Dollar / Swiss Franc",
    "enabled": true,
    "pipSize": 0.0001,
    "displayDecimals": 5,
    "candlePriceBasis": "mid"
  },
  {
    "id": "USD-IDR",
    "base": "USD",
    "quote": "IDR",
    "assetClass": "fx",
    "provider": "interbank",
    "providerSymbol": "USDIDR=X",
    "name": "US Dollar / Indonesian Rupiah",
    "enabled": true,
    "pipSize": 1,
    "displayDecimals": 2,
    "candlePriceBasis": "mid"
  },
  {
    "id": "EUR-JPY",
    "base": "EUR",
    "quote": "JPY",
    "assetClass": "fx",
    "provider": "interbank",
    "providerSymbol": "EURJPY=X",
    "name": "Euro / Japanese Yen",
    "enabled": true,
    "pipSize": 0.01,
    "displayDecimals": 3,
    "candlePriceBasis": "mid"
  }
];

export const DEFAULT_US_EQUITY_SYMBOLS: MarketSymbol[] = [
  {
    "id": "US:AAPL",
    "base": "AAPL",
    "quote": "USD",
    "assetClass": "us_stocks",
    "provider": "alpaca_iex",
    "providerSymbol": "AAPL",
    "name": "Apple Inc.",
    "enabled": true,
    "displayDecimals": 2,
    "candlePriceBasis": "trade",
    "exchange": "NASDAQ",
    "country": "US",
    "timezone": "America/New_York"
  },
  {
    "id": "US:NVDA",
    "base": "NVDA",
    "quote": "USD",
    "assetClass": "us_stocks",
    "provider": "alpaca_iex",
    "providerSymbol": "NVDA",
    "name": "NVIDIA Corp.",
    "enabled": true,
    "displayDecimals": 2,
    "candlePriceBasis": "trade",
    "exchange": "NASDAQ",
    "country": "US",
    "timezone": "America/New_York"
  },
  {
    "id": "US:MSFT",
    "base": "MSFT",
    "quote": "USD",
    "assetClass": "us_stocks",
    "provider": "alpaca_iex",
    "providerSymbol": "MSFT",
    "name": "Microsoft Corp.",
    "enabled": true,
    "displayDecimals": 2,
    "candlePriceBasis": "trade",
    "exchange": "NASDAQ",
    "country": "US",
    "timezone": "America/New_York"
  },
  {
    "id": "US:AMZN",
    "base": "AMZN",
    "quote": "USD",
    "assetClass": "us_stocks",
    "provider": "alpaca_iex",
    "providerSymbol": "AMZN",
    "name": "Amazon.com Inc.",
    "enabled": true,
    "displayDecimals": 2,
    "candlePriceBasis": "trade",
    "exchange": "NASDAQ",
    "country": "US",
    "timezone": "America/New_York"
  },
  {
    "id": "US:GOOGL",
    "base": "GOOGL",
    "quote": "USD",
    "assetClass": "us_stocks",
    "provider": "alpaca_iex",
    "providerSymbol": "GOOGL",
    "name": "Alphabet Inc.",
    "enabled": true,
    "displayDecimals": 2,
    "candlePriceBasis": "trade",
    "exchange": "NASDAQ",
    "country": "US",
    "timezone": "America/New_York"
  },
  {
    "id": "US:META",
    "base": "META",
    "quote": "USD",
    "assetClass": "us_stocks",
    "provider": "alpaca_iex",
    "providerSymbol": "META",
    "name": "Meta Platforms Inc.",
    "enabled": true,
    "displayDecimals": 2,
    "candlePriceBasis": "trade",
    "exchange": "NASDAQ",
    "country": "US",
    "timezone": "America/New_York"
  },
  {
    "id": "US:TSLA",
    "base": "TSLA",
    "quote": "USD",
    "assetClass": "us_stocks",
    "provider": "alpaca_iex",
    "providerSymbol": "TSLA",
    "name": "Tesla Inc.",
    "enabled": true,
    "displayDecimals": 2,
    "candlePriceBasis": "trade",
    "exchange": "NASDAQ",
    "country": "US",
    "timezone": "America/New_York"
  },
  {
    "id": "US:AMD",
    "base": "AMD",
    "quote": "USD",
    "assetClass": "us_stocks",
    "provider": "alpaca_iex",
    "providerSymbol": "AMD",
    "name": "Advanced Micro Devices",
    "enabled": true,
    "displayDecimals": 2,
    "candlePriceBasis": "trade",
    "exchange": "NASDAQ",
    "country": "US",
    "timezone": "America/New_York"
  }
];

export const DEFAULT_IDX_EQUITY_SYMBOLS: MarketSymbol[] = [
  {
    "id": "ID:BBCA",
    "base": "BBCA",
    "quote": "IDR",
    "assetClass": "idx_stocks",
    "provider": "idx_delayed",
    "providerSymbol": "BBCA.JK",
    "name": "Bank Central Asia Tbk",
    "enabled": true,
    "displayDecimals": 0,
    "candlePriceBasis": "trade",
    "exchange": "IDX",
    "country": "ID",
    "timezone": "Asia/Jakarta"
  },
  {
    "id": "ID:BBRI",
    "base": "BBRI",
    "quote": "IDR",
    "assetClass": "idx_stocks",
    "provider": "idx_delayed",
    "providerSymbol": "BBRI.JK",
    "name": "Bank Rakyat Indonesia Tbk",
    "enabled": true,
    "displayDecimals": 0,
    "candlePriceBasis": "trade",
    "exchange": "IDX",
    "country": "ID",
    "timezone": "Asia/Jakarta"
  },
  {
    "id": "ID:BMRI",
    "base": "BMRI",
    "quote": "IDR",
    "assetClass": "idx_stocks",
    "provider": "idx_delayed",
    "providerSymbol": "BMRI.JK",
    "name": "Bank Mandiri Tbk",
    "enabled": true,
    "displayDecimals": 0,
    "candlePriceBasis": "trade",
    "exchange": "IDX",
    "country": "ID",
    "timezone": "Asia/Jakarta"
  },
  {
    "id": "ID:BBNI",
    "base": "BBNI",
    "quote": "IDR",
    "assetClass": "idx_stocks",
    "provider": "idx_delayed",
    "providerSymbol": "BBNI.JK",
    "name": "Bank Negara Indonesia Tbk",
    "enabled": true,
    "displayDecimals": 0,
    "candlePriceBasis": "trade",
    "exchange": "IDX",
    "country": "ID",
    "timezone": "Asia/Jakarta"
  },
  {
    "id": "ID:ASII",
    "base": "ASII",
    "quote": "IDR",
    "assetClass": "idx_stocks",
    "provider": "idx_delayed",
    "providerSymbol": "ASII.JK",
    "name": "Astra International Tbk",
    "enabled": true,
    "displayDecimals": 0,
    "candlePriceBasis": "trade",
    "exchange": "IDX",
    "country": "ID",
    "timezone": "Asia/Jakarta"
  },
  {
    "id": "ID:TLKM",
    "base": "TLKM",
    "quote": "IDR",
    "assetClass": "idx_stocks",
    "provider": "idx_delayed",
    "providerSymbol": "TLKM.JK",
    "name": "Telkom Indonesia Tbk",
    "enabled": true,
    "displayDecimals": 0,
    "candlePriceBasis": "trade",
    "exchange": "IDX",
    "country": "ID",
    "timezone": "Asia/Jakarta"
  },
  {
    "id": "ID:ICBP",
    "base": "ICBP",
    "quote": "IDR",
    "assetClass": "idx_stocks",
    "provider": "idx_delayed",
    "providerSymbol": "ICBP.JK",
    "name": "Indofood CBP Sukses Makmur Tbk",
    "enabled": true,
    "displayDecimals": 0,
    "candlePriceBasis": "trade",
    "exchange": "IDX",
    "country": "ID",
    "timezone": "Asia/Jakarta"
  },
  {
    "id": "ID:AMMN",
    "base": "AMMN",
    "quote": "IDR",
    "assetClass": "idx_stocks",
    "provider": "idx_delayed",
    "providerSymbol": "AMMN.JK",
    "name": "Amman Mineral Internasional Tbk",
    "enabled": true,
    "displayDecimals": 0,
    "candlePriceBasis": "trade",
    "exchange": "IDX",
    "country": "ID",
    "timezone": "Asia/Jakarta"
  }
];

export function deduplicateSymbols(list: MarketSymbol[]): MarketSymbol[] {
  const seen = new Set<string>();
  const unique: MarketSymbol[] = [];
  for (const s of list) {
    if (s && s.id && !seen.has(s.id)) {
      seen.add(s.id);
      unique.push(s);
    }
  }
  return unique;
}

export const DEFAULT_SYMBOLS: MarketSymbol[] = deduplicateSymbols([
  ...DEFAULT_CRYPTO_SYMBOLS,
  ...DEFAULT_FX_SYMBOLS,
  ...DEFAULT_US_EQUITY_SYMBOLS,
  ...DEFAULT_IDX_EQUITY_SYMBOLS,
]);
