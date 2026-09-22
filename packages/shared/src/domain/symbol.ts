export type AssetClass = "crypto" | "metal" | "fx";

export interface MarketSymbol {
  id: string; // Canonical identifier e.g. "BTC-USDT"
  base: string; // "BTC"
  quote: string; // "USDT"
  assetClass: AssetClass;
  provider: string; // "binance"
  providerSymbol: string; // "BTCUSDT"
  name: string; // "Bitcoin"
  enabled: boolean;
  isTokenizedMetal?: boolean; // True for PAXG/XAUT (tokenized gold per architecture specification)
}

export const DEFAULT_SYMBOLS: MarketSymbol[] = [
  {
    id: "BTC-USDT",
    base: "BTC",
    quote: "USDT",
    assetClass: "crypto",
    provider: "binance",
    providerSymbol: "BTCUSDT",
    name: "Bitcoin",
    enabled: true,
  },
  {
    id: "ETH-USDT",
    base: "ETH",
    quote: "USDT",
    assetClass: "crypto",
    provider: "binance",
    providerSymbol: "ETHUSDT",
    name: "Ethereum",
    enabled: true,
  },
  {
    id: "SOL-USDT",
    base: "SOL",
    quote: "USDT",
    assetClass: "crypto",
    provider: "binance",
    providerSymbol: "SOLUSDT",
    name: "Solana",
    enabled: true,
  },
  {
    id: "BNB-USDT",
    base: "BNB",
    quote: "USDT",
    assetClass: "crypto",
    provider: "binance",
    providerSymbol: "BNBUSDT",
    name: "BNB",
    enabled: true,
  },
  {
    id: "XRP-USDT",
    base: "XRP",
    quote: "USDT",
    assetClass: "crypto",
    provider: "binance",
    providerSymbol: "XRPUSDT",
    name: "XRP",
    enabled: true,
  },
  {
    id: "PAXG-USDT",
    base: "PAXG",
    quote: "USDT",
    assetClass: "metal",
    provider: "binance",
    providerSymbol: "PAXGUSDT",
    name: "Paxos Gold (Tokenized Gold)",
    enabled: true,
    isTokenizedMetal: true,
  },
];
