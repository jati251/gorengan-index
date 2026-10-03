import { publicData, finite, type SourceState, type PublicResult } from "./publicData";
import { parseYahooQuote, parseBitcoinTransactions, parseNews, parseIbitHoldings } from "./radarParsers";
import type { WhaleRadarData, EtfQuote, CommodityQuote, WhaleEntity } from "../../features/whale/types";

export function sourceState(result: PublicResult<unknown>): SourceState {
  const { data: _data, ...source } = result;
  return source;
}
const etfs = [
  ["IBIT", "iShares Bitcoin Trust ETF", "BlackRock"], ["FBTC", "Fidelity Wise Origin Bitcoin Fund", "Fidelity"],
  ["BITB", "Bitwise Bitcoin ETF", "Bitwise"], ["ARKB", "ARK 21Shares Bitcoin ETF", "21Shares"], ["GBTC", "Grayscale Bitcoin Trust ETF", "Grayscale"],
];
const commodities: [string, string, CommodityQuote["assetType"], string][] = [
  ["GC=F", "Gold futures", "GOLD", "USD / troy oz"], ["SI=F", "Silver futures", "SILVER", "USD / troy oz"],
  ["CL=F", "WTI crude futures", "OIL", "USD / barrel"], ["BZ=F", "Brent crude futures", "OIL", "USD / barrel"],
  ["GLD", "SPDR Gold Shares", "GOLD", "USD / share"], ["SLV", "iShares Silver Trust", "SILVER", "USD / share"],
  ["USO", "United States Oil Fund", "OIL", "USD / share"], ["BNO", "United States Brent Oil Fund", "OIL", "USD / share"],
  ["XLE", "Energy Select Sector SPDR", "OIL", "USD / share"],
];
export async function yahooQuote(symbol: string) {
  return publicData.read(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=5d&interval=1d`, {
    source: `Yahoo Finance · ${symbol}`, ttlMs: 300_000, maxStaleMs: 86_400_000,
    parse: (text) => { const quote = parseYahooQuote(text); if (quote.currency !== "USD") throw new Error("Unexpected quote currency"); return quote; },
  });
}
export async function readNews() {
  return publicData.read("https://www.coindesk.com/arc/outboundfeeds/rss", {
    source: "CoinDesk RSS", ttlMs: 300_000, maxStaleMs: 3_600_000, parse: (text) => parseNews(text, "CoinDesk"),
  });
}
export async function getRadar(): Promise<WhaleRadarData> {
  const addresses = [...new Set((process.env.BITCOIN_WATCH_ADDRESSES ?? "34xp4vRoCGJym3xR7yCVPFHoCNxv4Twseo,1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa")
    .split(",").map((a) => a.trim()).filter((a) => /^(?:[13][a-km-zA-HJ-NP-Z1-9]{25,34}|bc1[a-z0-9]{25,87})$/.test(a)))].slice(0, 20);
  const [btc, quotes, commodityQuotes, txs, balances, supply, news, holdings] = await Promise.all([
    yahooQuote("BTC-USD"), Promise.all(etfs.map(([symbol]) => yahooQuote(symbol))),
    Promise.all(commodities.map(([symbol]) => yahooQuote(symbol))),
    publicData.read("https://blockchain.info/unconfirmed-transactions?format=json", { source: "Blockchain.com mempool sample", ttlMs: 60_000, maxStaleMs: 180_000, parse: parseBitcoinTransactions }),
    publicData.read(`https://blockchain.info/balance?active=${addresses.join("|")}`, { source: "Blockchain.com address balances", ttlMs: 300_000, maxStaleMs: 3_600_000, parse: (raw) => {
      const data = JSON.parse(raw); if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("Invalid balances"); return data as Record<string, { final_balance: number }>;
    } }),
    publicData.read("https://blockchain.info/q/totalbc", { source: "Blockchain.com mined supply", ttlMs: 3_600_000, maxStaleMs: 86_400_000, parse: (raw) => {
      const sats = finite(raw); if (!sats || sats <= 0 || sats > 21e14) throw new Error("Invalid supply"); return sats / 1e8;
    } }), readNews(),
    publicData.read("https://www.ishares.com/us/products/333011/ishares-bitcoin-trust-etf/latest-holdings.csv", { source: "BlackRock IBIT holdings", ttlMs: 3_600_000, maxStaleMs: 86_400_000, parse: parseIbitHoldings }),
  ]);
  // A reference USD valuation is only used while its source quote remains recent.
  const btcPrice = btc.data && Date.now() - btc.data.asOf < 300_000 && btc.data.asOf <= Date.now() + 60_000 ? btc.data.price : null;
  const allEtfs: EtfQuote[] = etfs.map(([symbol, name, issuer], i) => ({ symbol, name, issuer, tickerId: `US:${symbol}`,
    price: quotes[i].data?.price ?? null, change24h: quotes[i].data?.change24h ?? null,
    changePercent24h: quotes[i].data?.changePercent24h ?? null, volume24h: quotes[i].data?.volume24h ?? null,
    btcHeld: null, aumUsd: null, asOf: quotes[i].data?.asOf ?? null, source: sourceState(quotes[i]) }));
  allEtfs[0].btcHeld = holdings.data?.btcHeld ?? null;
  allEtfs[0].aumUsd = holdings.data?.marketValueUsd ?? null;
  const allCommodities: CommodityQuote[] = commodities.map(([symbol, name, assetType, unit], i) => ({ id: symbol, symbol, name, assetType, unit,
    price: commodityQuotes[i].data?.price ?? null, changePercent24h: commodityQuotes[i].data?.changePercent24h ?? null,
    volume24h: commodityQuotes[i].data?.volume24h ?? null, asOf: commodityQuotes[i].data?.asOf ?? null, source: sourceState(commodityQuotes[i]) }));
  const whaleEntities: WhaleEntity[] = addresses.flatMap((address) => {
    const sats = finite(balances.data?.[address]?.final_balance);
    if (sats === null || !Number.isSafeInteger(sats) || sats < 0) return [];
    const balanceBtc = sats / 1e8;
    return [{ id: address, name: "Tracked Bitcoin address", category: "UNATTRIBUTED", address, addressShort: `${address.slice(0, 8)}…${address.slice(-6)}`,
      balanceBtc, balanceUsd: btcPrice === null ? null : balanceBtc * btcPrice,
      shareOfCirculatingSupply: supply.data ? balanceBtc / supply.data * 100 : null,
      verified: false, labelNote: "Address balance only; owner and exchange affiliation are unverified.",
      explorerUrl: `https://mempool.space/address/${address}`, source: sourceState(balances) }];
  });
  const posts = news.data ?? [], mentions = new Map<string, number>();
  for (const post of posts) for (const asset of post.assets) mentions.set(asset, (mentions.get(asset) ?? 0) + 1);
  const directional = posts.filter((p) => p.sentiment !== "NEUTRAL");
  const score = directional.length ? directional.filter((p) => p.sentiment === "BULLISH").length / directional.length * 100 : null;
  const total = whaleEntities.length ? whaleEntities.reduce((sum, entity) => sum + entity.balanceBtc, 0) : null;
  const gold = allCommodities[0], silver = allCommodities[1];
  return { fetchedAt: Date.now(), btcPrice,
    etfSummary: { ibit: allEtfs[0], allEtfs, totalBtcReserves: null, totalAumUsd: null, totalBtcSupplySharePercent: null,
      fiveDayNetFlowUsd: null, institutionalSignal: "UNAVAILABLE", recentFlows: [], holdingsAsOf: holdings.data?.asOf ?? null },
    whaleEntities, recentLargeTxs: (txs.data ?? []).map((tx) => ({ ...tx, amountUsd: btcPrice === null ? null : tx.amountBtc * btcPrice })),
    commodities: { allCommodities, goldSilverRatio: gold.price && silver.price && gold.asOf && silver.asOf && Math.abs(gold.asOf - silver.asOf) <= 3600000 ? gold.price / silver.price : null },
    vipSocialFeed: { posts, topMentionedAssets: [...mentions].map(([asset, count]) => ({ asset, count })).sort((a, b) => b.count - a.count),
      vipSentimentScore: score, overallSentiment: score === null ? "UNAVAILABLE" : score > 60 ? "BULLISH" : score < 40 ? "BEARISH" : "NEUTRAL" },
    stats: { circulatingSupplyBtc: supply.data, topWhalesHoldingsBtc: total, topWhalesSupplySharePercent: total !== null && supply.data ? total / supply.data * 100 : null,
      accumulationScore: null, marketSentiment: "UNAVAILABLE" },
    sources: [btc, ...quotes, ...commodityQuotes, txs, balances, supply, news, holdings].map(sourceState),
  };
}
