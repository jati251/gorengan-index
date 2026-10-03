export type WhaleCategory =
  | "INSTITUTION"
  | "EXCHANGE"
  | "GOVERNMENT"
  | "FOUNDER"
  | "CORPORATE";

export interface EtfQuote {
  symbol: string;
  name: string;
  issuer: string;
  tickerId: string;
  price: number;
  change24h: number;
  changePercent24h: number;
  volume24h: number;
  btcHeld: number;
  aumUsd: number;
  expenseRatio: number;
  custodian: string;
  launchDate: string;
}

export interface DailyEtfFlow {
  date: string;
  ibitFlowUsd: number;      // Net flow in millions USD for IBIT
  fbtcFlowUsd: number;      // Net flow in millions USD for FBTC
  totalNetFlowUsd: number;  // Total US spot ETF net flow in millions USD
  btcPrice: number;
  sentiment: "INFLOW" | "OUTFLOW" | "NEUTRAL";
}

export interface WhaleEntity {
  id: string;
  name: string;
  category: WhaleCategory;
  address: string;
  addressShort: string;
  balanceBtc: number;
  balanceUsd: number;
  shareOfCirculatingSupply: number;
  labelNote: string;
  verified: boolean;
  explorerUrl: string;
  lastActiveDate?: string;
}

export type WhaleTxType = "INFLOW" | "OUTFLOW" | "TRANSFER";

export interface WhaleTransaction {
  txid: string;
  txidShort: string;
  timestamp: number;
  amountBtc: number;
  amountUsd: number;
  feeBtc: number;
  type: WhaleTxType;
  senderLabel: string;
  receiverLabel: string;
  status: "CONFIRMED" | "MEMPOOL";
  explorerUrl: string;
}

export interface CommodityQuote {
  id: string;
  symbol: string;
  name: string;
  assetType: "GOLD" | "SILVER" | "OIL";
  category: "PHYSICAL_BACKED" | "CRUDE_OIL" | "EQUITY_BASKET";
  price: number;
  change24h: number;
  changePercent24h: number;
  volume24h: number;
  issuer: string;
  benchmark: string;
  description: string;
  backingReserves?: string;
  unit: string;
}

export interface CommoditySummary {
  gold: {
    paxg: CommodityQuote;
    gld: CommodityQuote;
    totalGoldAumUsd: number;
    goldSilverRatio: number;
  };
  silver: {
    slv: CommodityQuote;
    goldSilverRatio: number;
  };
  oil: {
    uso: CommodityQuote;
    bno: CommodityQuote;
    xle: CommodityQuote;
    wtiBenchmarkPrice: number;
    brentBenchmarkPrice: number;
    marketSentiment: "BULLISH" | "NEUTRAL" | "BEARISH";
  };
  allCommodities: CommodityQuote[];
}

export type XVipCategory =
  | "KONGLO_TECH"
  | "BITCOIN_WHALE"
  | "INSTITUTIONAL"
  | "MACRO_POLITICS"
  | "GOLD_COMMODITIES";

export interface XVipPost {
  id: string;
  author: {
    name: string;
    handle: string;
    avatarUrl?: string;
    initials: string;
    role: string;
    category: XVipCategory;
    verifiedType: "BLUE" | "GOLD" | "GOV";
    followersCount: string;
  };
  content: string;
  timestamp: number;
  timeAgoText: string;
  metrics: {
    likes: number;
    retweets: number;
    views: string;
  };
  signal: {
    type: "STRONG_BULLISH" | "BULLISH" | "MACRO_ALERT" | "WHALE_ALERT" | "CONTRARIAN";
    targetAsset: "BTC" | "ETH" | "GOLD" | "SILVER" | "OIL" | "MACRO" | "TECH";
    confidenceScore: number;
    impactLevel: "CRITICAL" | "HIGH" | "MEDIUM";
    analysisText: string;
  };
  url: string;
}

export interface XVipSummary {
  vipSentimentScore: number;
  overallSentiment: "STRONG_BULLISH" | "BULLISH" | "NEUTRAL" | "BEARISH";
  topMentionedAssets: { asset: string; count: number; sentiment: "BULLISH" | "BEARISH" | "NEUTRAL" }[];
  posts: XVipPost[];
}

export interface WhaleRadarData {
  fetchedAt: number;
  btcPrice: number;
  etfSummary: {
    ibit: EtfQuote;
    allEtfs: EtfQuote[];
    totalBtcReserves: number;
    totalAumUsd: number;
    totalBtcSupplySharePercent: number;
    fiveDayNetFlowUsd: number;
    institutionalSignal: "STRONG_BUY" | "ACCUMULATION" | "NEUTRAL" | "DISTRIBUTION";
    recentFlows: DailyEtfFlow[];
  };
  whaleEntities: WhaleEntity[];
  recentLargeTxs: WhaleTransaction[];
  commodities: CommoditySummary;
  vipSocialFeed: XVipSummary;
  stats: {
    circulatingSupplyBtc: number;
    topWhalesHoldingsBtc: number;
    topWhalesSupplySharePercent: number;
    accumulationScore: number; // 0-100
    marketSentiment: "BULLISH" | "NEUTRAL" | "BEARISH";
  };
}


