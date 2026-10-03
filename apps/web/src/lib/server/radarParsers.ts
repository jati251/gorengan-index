import { finite } from "./publicData";
import type { NewsItem, WhaleTransaction } from "../../features/whale/types";

export function parseYahooQuote(text: string) {
  const result = JSON.parse(text)?.chart?.result?.[0];
  const meta = result?.meta;
  const price = finite(meta?.regularMarketPrice), timestamp = finite(meta?.regularMarketTime);
  if (price === null || price <= 0 || !timestamp) throw new Error("Missing quote or quote timestamp");
  const closes = result?.indicators?.quote?.[0]?.close;
  const previous = finite(meta.previousClose) ?? (Array.isArray(closes) && closes.length > 1
    ? finite(closes.at(-2)) : finite(meta.chartPreviousClose));
  return { price, currency: String(meta.currency), asOf: timestamp * 1000,
    change24h: previous && previous > 0 ? price - previous : null,
    changePercent24h: previous && previous > 0 ? (price / previous - 1) * 100 : null,
    volume24h: finite(meta.regularMarketVolume),
  };
}

export function parseBitcoinTransactions(text: string, now = Date.now()): WhaleTransaction[] {
  const payload = JSON.parse(text);
  if (!Array.isArray(payload.txs)) throw new Error("Missing transaction list");
  const unique = new Map<string, WhaleTransaction>();
  for (const tx of payload.txs) {
    if (!/^[a-f0-9]{64}$/.test(tx.hash) || !Array.isArray(tx.out) || !tx.out.length) continue;
    const outputs = tx.out.map((out: { value?: unknown }) => finite(out.value));
    if (outputs.some((value: number | null) => value === null || !Number.isSafeInteger(value) || value < 0)) continue;
    const total = outputs.reduce((sum: number, value: number) => sum + value, 0);
    const timestamp = finite(tx.time);
    if (!Number.isSafeInteger(total) || !timestamp || timestamp * 1000 > now + 60_000 || now - timestamp * 1000 > 86_400_000) continue;
    if (total < 5 * 100_000_000) continue;
    unique.set(tx.hash, { txid: tx.hash, txidShort: `${tx.hash.slice(0, 8)}…${tx.hash.slice(-8)}`,
      timestamp: timestamp * 1000, amountBtc: total / 1e8, amountUsd: null,
      feeBtc: finite(tx.fee) !== null && tx.fee >= 0 ? tx.fee / 1e8 : null,
      type: "TRANSFER", senderLabel: `${tx.inputs?.length ?? "?"} inputs`, receiverLabel: `${tx.out.length} outputs`,
      status: "MEMPOOL", explorerUrl: `https://mempool.space/tx/${tx.hash}` });
  }
  return [...unique.values()].sort((a, b) => b.amountBtc - a.amountBtc).slice(0, 30);
}

export function decodeXml(value: string): string {
  return value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/<[^>]+>/g, "")
    .replace(/&(?:amp|lt|gt|quot|apos|#39);/g, (s) => ({ "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&apos;": "'", "&#39;": "'" }[s]!))
    .replace(/&#(x[\da-f]+|\d+);/gi, (_, n: string) => { const code = n[0].toLowerCase() === "x" ? parseInt(n.slice(1), 16) : Number(n); return code <= 0x10ffff ? String.fromCodePoint(code) : ""; }).trim();
}
export function tag(xml: string, name: string): string {
  return decodeXml(xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, "i"))?.[1] ?? "");
}
export function parseNews(text: string, publisher: string, now = Date.now()): NewsItem[] {
  if (!/<rss[\s>]/i.test(text)) throw new Error("Expected RSS feed");
  const posts = new Map<string, NewsItem>();
  for (const item of text.match(/<item[\s>][\s\S]*?<\/item>/gi) ?? []) {
    const title = tag(item, "title"), url = tag(item, "link"), publishedAt = Date.parse(tag(item, "pubDate"));
    if (!title || !/^https:\/\//.test(url) || !Number.isFinite(publishedAt) || publishedAt > now + 60_000 || now - publishedAt > 7 * 86_400_000) continue;
    const subject = "\\b(?:bitcoin|btc|ethereum|ether|eth|gold|oil|crude|nasdaq)(?: prices?)?\\s+";
    const ambiguous = /\b(not|never|revers(?:e[sd]?|ing)|erase[sd]?|despite|could|might|may)\b/i.test(title);
    const bullish = !ambiguous && new RegExp(subject + "(?:surge[sd]?|rall(?:y|ies)|gain[sd]?|rise[sd]?)\\b", "i").test(title);
    const bearish = !ambiguous && new RegExp(subject + "(?:crash(?:es)?|drop[sd]?|fall[sd]?|plunge[sd]?)\\b", "i").test(title);
    const assets = Object.entries({ BTC: /\b(bitcoin|btc)\b/i, ETH: /\b(ethereum|ether|eth)\b/i, GOLD: /\b(gold|bullion)\b/i, OIL: /\b(oil|crude)\b/i, TECH: /\b(nasdaq|tech|technology)\b/i })
      .filter(([, pattern]) => pattern.test(title)).map(([asset]) => asset);
    posts.set(url, { id: url, title, url, publishedAt, publisher, assets,
      sentiment: bullish === bearish ? "NEUTRAL" : bullish ? "BULLISH" : "BEARISH" });
  }
  return [...posts.values()].sort((a, b) => b.publishedAt - a.publishedAt).slice(0, 40);
}

export function parseIbitHoldings(text: string) {
  const rows = text.trim().split(/\r?\n/).map((line) => (line.match(/("(?:[^"]|"")*"|[^,]+)(,|$)/g) ?? []).map((cell) => cell.replace(/,$/, "").replace(/^"|"$/g, "").replace(/""/g, '"')));
  const date = rows.find((row) => row[0] === "Fund Holdings as of")?.[1];
  const asOf = Date.parse(date ? `${date} UTC` : "");
  const header = rows.findIndex((row) => row[0] === "Ticker" && row.includes("Quantity"));
  const btc = rows.slice(header + 1).find((row) => row[0] === "BTC" && row[1] === "BITCOIN");
  const quantity = btc && finite(btc[rows[header]?.indexOf("Quantity")]?.replaceAll(",", ""));
  const value = btc && finite(btc[rows[header]?.indexOf("Market Value")]?.replaceAll(",", ""));
  if (header < 0 || !Number.isFinite(asOf) || !quantity || quantity < 0 || !value || value < 0) throw new Error("Unrecognized issuer holdings CSV");
  if (asOf > Date.now() + 86_400_000 || Date.now() - asOf > 14 * 86_400_000) throw new Error("Issuer holdings date out of range");
  return { btcHeld: quantity, marketValueUsd: value, asOf: new Date(asOf).toISOString().slice(0, 10) };
}
