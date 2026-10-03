import { readNews } from "@/lib/server/radar";
export async function GET() {
  const result = await readNews();
  if (!result.data) return Response.json({ error: result.error ?? "News unavailable" }, { status: 502 });
  return Response.json(result.data.map((p) => ({ id: p.id, title: p.title, link: p.url, publishedAt: new Date(p.publishedAt).toISOString(), source: p.publisher, sentiment: p.sentiment, impact: "LOW", symbols: p.assets })), { headers: { "Cache-Control": "no-store", "X-Data-Status": result.status } });
}
