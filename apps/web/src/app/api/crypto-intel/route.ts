import { parseDepth, parseTrades, parseFunding, parseOpenInterest, type CryptoFlow } from "@/features/analysis/utils/cryptoFlow";

const snapshots = new Map<string, { expires: number; promise: Promise<CryptoFlow> }>();

export async function GET(request: Request) {
  const symbol = new URL(request.url).searchParams.get("symbol") ?? "";
  if (!/^[A-Z0-9]{2,15}-USDT$/.test(symbol)) return Response.json({ error: "Select a crypto / USDT pair." }, { status: 400 });
  const pair = symbol.replace("-", "");
  const cached = snapshots.get(symbol);
  if (cached && cached.expires > Date.now()) return Response.json(await cached.promise, { headers: { "Cache-Control": "no-store" } });
  async function read(url: string) {
    const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error(`Upstream ${response.status}`);
    return response.json() as Promise<unknown>;
  }
  const promise = (async (): Promise<CryptoFlow> => {
  const results = await Promise.allSettled([
    read(`https://data-api.binance.vision/api/v3/depth?symbol=${pair}&limit=20`).then(parseDepth),
    read(`https://data-api.binance.vision/api/v3/aggTrades?symbol=${pair}&limit=500`).then(parseTrades),
    read(`https://fapi.binance.com/fapi/v1/premiumIndex?symbol=${pair}`).then((v) => parseFunding(v, pair)),
    read(`https://fapi.binance.com/fapi/v1/openInterest?symbol=${pair}`).then((v) => parseOpenInterest(v, pair)),
  ] as const);
  const [depth, trades, derivatives, openInterest] = results;
  const names = ["spot depth", "spot trades", "perpetual funding", "perpetual open interest"];
  return { symbol, fetchedAt: Date.now(),
    depth: depth.status === "fulfilled" ? depth.value : null,
    trades: trades.status === "fulfilled" ? trades.value : null,
    derivatives: derivatives.status === "fulfilled" ? derivatives.value : null,
    openInterest: openInterest.status === "fulfilled" ? openInterest.value : null,
    unavailable: results.flatMap((r, i) => r.status === "rejected" ? [names[i]] : []),
  };
  })();
  if (snapshots.size >= 100) snapshots.delete(snapshots.keys().next().value!);
  snapshots.set(symbol, { expires: Date.now() + 15000, promise });
  return Response.json(await promise, { headers: { "Cache-Control": "no-store" } });
}
