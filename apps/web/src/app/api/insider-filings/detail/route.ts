import { publicData } from "@/lib/server/publicData";
import { parseOwnershipXml } from "@/features/insider/utils/filings";
export async function GET(request: Request) {
  const p = new URL(request.url).searchParams, cik = p.get("cik") ?? "", accession = p.get("accession") ?? "", document = p.get("document") ?? "";
  if (!/^\d{1,10}$/.test(cik) || !/^\d{10}-\d{2}-\d{6}$/.test(accession) || !/^[\w-]{1,150}\.xml$/i.test(document)) return Response.json({ error: "Invalid filing reference" }, { status: 400 });
  const url = `https://www.sec.gov/Archives/edgar/data/${Number(cik)}/${accession.replaceAll("-", "")}/${document}`;
  if (!process.env.SEC_USER_AGENT) return Response.json({ source: "SEC ownership XML", url, status: "unavailable", fetchedAt: null, data: null, error: "Set SEC_USER_AGENT to your application name and contact email to request filing XML." });
  const result = await publicData.read(url, { source: "SEC ownership XML", ttlMs: 86400000, maxStaleMs: 7 * 86400000, intervalMs: 500, headers: { "User-Agent": process.env.SEC_USER_AGENT }, parse: parseOwnershipXml });
  return Response.json(result, { headers: { "Cache-Control": "no-store" } });
}
