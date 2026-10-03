import { publicData, finite } from "@/lib/server/publicData";
export async function GET() {
  const result = await publicData.read("https://api.alternative.me/fng/?limit=1", { source: "Alternative.me Crypto Fear & Greed Index", ttlMs: 3600000, maxStaleMs: 0, parse: (text) => {
    const row = JSON.parse(text)?.data?.[0], value = finite(row?.value), timestamp = finite(row?.timestamp);
    if (value === null || value < 0 || value > 100 || !timestamp || Date.now() - timestamp * 1000 > 2 * 86400000 || timestamp * 1000 > Date.now() + 60000) throw new Error("Invalid or stale sentiment reading");
    return { value, classification: String(row.value_classification), timestamp: String(timestamp) };
  } });
  return result.data ? Response.json(result.data, { headers: { "Cache-Control": "no-store" } }) : Response.json({ error: result.error ?? "Sentiment unavailable" }, { status: 502 });
}
