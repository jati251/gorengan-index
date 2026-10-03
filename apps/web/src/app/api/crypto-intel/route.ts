import { parseDepth, parseTrades, parseFunding, parseOpenInterest, type CryptoFlow } from "@/features/analysis/utils/cryptoFlow";
import { publicData } from "@/lib/server/publicData";
import { sourceState } from "@/lib/server/radar";
export async function GET(request: Request) {
  const symbol = new URL(request.url).searchParams.get("symbol") ?? "";
  if (!/^[A-Z0-9]{2,15}-USDT$/.test(symbol)) return Response.json({ error: "Select a crypto / USDT pair." }, { status: 400 });
  const pair = symbol.replace("-", "");
  const options = { ttlMs: 15_000, maxStaleMs: 0, intervalMs: 250 };
  const [depth, trades, derivatives, openInterest] = await Promise.all([
    publicData.read(`https://data-api.binance.vision/api/v3/depth?symbol=${pair}&limit=20`, { ...options, source: "Binance spot depth", parse: (s) => parseDepth(JSON.parse(s)) }),
    publicData.read(`https://data-api.binance.vision/api/v3/aggTrades?symbol=${pair}&limit=500`, { ...options, source: "Binance spot trades", parse: (s) => parseTrades(JSON.parse(s)) }),
    publicData.read(`https://fapi.binance.com/fapi/v1/premiumIndex?symbol=${pair}`, { ...options, source: "Binance perpetual funding", parse: (s) => parseFunding(JSON.parse(s), pair) }),
    publicData.read(`https://fapi.binance.com/fapi/v1/openInterest?symbol=${pair}`, { ...options, source: "Binance perpetual OI", parse: (s) => parseOpenInterest(JSON.parse(s), pair) }),
  ]);
  const sources = [depth, trades, derivatives, openInterest].map(sourceState);
  const result: CryptoFlow = { symbol, fetchedAt: Math.min(...sources.flatMap((s) => s.status !== "unavailable" && s.fetchedAt ? [s.fetchedAt] : []), Date.now()),
    depth: depth.data, trades: trades.data, derivatives: derivatives.data, openInterest: openInterest.data,
    unavailable: sources.filter((s) => s.status === "unavailable").map((s) => s.source), sources };
  return Response.json(result, { headers: { "Cache-Control": "no-store" } });
}
