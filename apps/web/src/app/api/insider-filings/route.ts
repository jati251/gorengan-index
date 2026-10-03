import { publicData } from "@/lib/server/publicData";
import { filingsCsv, parseFilings } from "@/features/insider/utils/filings";
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const q = (params.get("q") ?? "").trim(), offset = Number(params.get("offset") ?? 0), days = Number(params.get("days") ?? 30);
  if (q.length > 80 || ![7, 30, 90].includes(days) || !Number.isInteger(offset) || offset < 0 || offset > 900 || offset % 100 !== 0) return Response.json({ error: "Invalid search, date window or page." }, { status: 400 });
  const end = new Date(), start = new Date(end.getTime() - days * 86400000);
  const query = new URLSearchParams({ forms: "4", dateRange: "custom", startdt: start.toISOString().slice(0, 10), enddt: end.toISOString().slice(0, 10), from: String(offset), sort: "desc" });
  if (q) query.set("q", q);
  const result = await publicData.read(`https://efts.sec.gov/LATEST/search-index?${query}`, {
    source: "SEC EDGAR full-text search", ttlMs: 300_000, maxStaleMs: 86_400_000, intervalMs: 500,
    headers: process.env.SEC_USER_AGENT ? { "User-Agent": process.env.SEC_USER_AGENT } : undefined, parse: parseFilings,
  });
  const { data, ...source } = result;
  if (params.get("format") === "csv") {
    if (!data) return Response.json({ error: source.error ?? "SEC unavailable" }, { status: 503 });
    return new Response(filingsCsv(data.filings), { headers: {
      "Content-Type": "text/csv; charset=utf-8", "Cache-Control": "no-store",
      "Content-Disposition": `attachment; filename="sec-form4-${end.toISOString().slice(0, 10)}.csv"`,
      "X-Data-Status": source.status,
    } });
  }
  return Response.json({ filings: data?.filings ?? [], total: data?.total ?? 0, totalIsLowerBound: data?.totalIsLowerBound ?? false, source, offset, pageSize: 100 }, { headers: { "Cache-Control": "no-store" } });
}
