export async function GET() {
  try {
    const response = await fetch("https://api.frankfurter.dev/v2/rate/USD/IDR", {
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error("Exchange rate unavailable");
    const data = await response.json();
    if (data.base !== "USD" || data.quote !== "IDR" || !Number.isFinite(data.rate) || data.rate <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(data.date) || !Number.isFinite(Date.parse(data.date))) {
      throw new Error("Invalid exchange rate");
    }
    return Response.json({ rate: data.rate, date: data.date, fetchedAt: new Date().toISOString(), source: "Frankfurter" }, {
      headers: { "Cache-Control": "public, max-age=300, s-maxage=300" },
    });
  } catch {
    return Response.json({ error: "Exchange rate temporarily unavailable" }, { status: 502 });
  }
}
