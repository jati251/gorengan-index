import { getRadar } from "@/lib/server/radar";

export async function GET() {
  try {
    return Response.json(await getRadar(), { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "Radar data unavailable; retry shortly." }, { status: 502 });
  }
}
