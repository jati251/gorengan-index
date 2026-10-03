import type { EtfActivity } from "@/lib/server/etfActivity";
import type { SourceState } from "@/lib/server/publicData";
export type WhaleCategory = "INSTITUTION" | "EXCHANGE" | "GOVERNMENT" | "FOUNDER" | "CORPORATE" | "UNATTRIBUTED";
export interface EtfQuote {
  symbol: string; name: string; issuer: string; tickerId: string;
  price: number | null; change24h: number | null; changePercent24h: number | null; volume24h: number | null;
  btcHeld: number | null; aumUsd: number | null; asOf: number | null; source: SourceState;
}
export interface DailyEtfFlow { date: string; ibitFlowUsd: number; fbtcFlowUsd: number; totalNetFlowUsd: number; btcPrice: number; sentiment: "INFLOW" | "OUTFLOW" | "NEUTRAL" }
export interface WhaleEntity {
  id: string; name: string; category: WhaleCategory; address: string; addressShort: string;
  balanceBtc: number; balanceUsd: number | null; shareOfCirculatingSupply: number | null;
  labelNote: string; verified: boolean; explorerUrl: string; source: SourceState;
}
export interface WhaleTransaction {
  txid: string; txidShort: string; timestamp: number; amountBtc: number; amountUsd: number | null;
  feeBtc: number | null; type: "INFLOW" | "OUTFLOW" | "TRANSFER"; senderLabel: string; receiverLabel: string;
  status: "CONFIRMED" | "MEMPOOL"; explorerUrl: string;
}
export interface CommodityQuote {
  id: string; symbol: string; name: string; assetType: "GOLD" | "SILVER" | "OIL";
  price: number | null; changePercent24h: number | null; volume24h: number | null; unit: string;
  asOf: number | null; source: SourceState;
}
export interface NewsItem {
  id: string; title: string; url: string; publishedAt: number; publisher: string;
  sentiment: "BULLISH" | "BEARISH" | "NEUTRAL"; assets: string[];
}
export interface WhaleRadarData {
  fetchedAt: number; btcPrice: number | null;
  etfSummary: {
    ibit: EtfQuote; allEtfs: EtfQuote[]; totalBtcReserves: number | null; totalAumUsd: number | null;
    totalBtcSupplySharePercent: number | null; fiveDayNetFlowUsd: number | null;
    institutionalSignal: "UNAVAILABLE"; recentFlows: DailyEtfFlow[];
    holdingsAsOf: string | null; activity: EtfActivity;
  };
  whaleEntities: WhaleEntity[]; recentLargeTxs: WhaleTransaction[];
  commodities: { allCommodities: CommodityQuote[]; goldSilverRatio: number | null };
  vipSocialFeed: { posts: NewsItem[]; topMentionedAssets: { asset: string; count: number }[]; vipSentimentScore: number | null; overallSentiment: string };
  stats: {
    circulatingSupplyBtc: number | null; topWhalesHoldingsBtc: number | null;
    topWhalesSupplySharePercent: number | null; accumulationScore: null; marketSentiment: "UNAVAILABLE";
  };
  sources: SourceState[];
}
