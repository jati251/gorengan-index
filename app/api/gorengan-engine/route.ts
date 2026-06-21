import { NextResponse } from "next/server";
import { calculateShrinkage } from "@/data/gorenganData";
import { indonesiaUMP } from "@/data/indonesiaUmp";

// Force dynamic so it doesn't cache and actually fluctuates every minute
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // 0. Fetch Real Time from Time API (Jakarta Zone)
    let currentISOTime = new Date().toISOString();
    try {
      const res = await fetch('https://timeapi.io/api/Time/current/zone?timeZone=Asia/Jakarta', { cache: 'no-store' });
      if (res.ok) {
        const timeData = await res.json();
        if (timeData.dateTime) {
          currentISOTime = timeData.dateTime + "+07:00"; // TimeAPI returns local time, append WIB offset
        }
      }
    } catch (e) {
      console.warn("Time API failed, falling back to server time", e);
    }

    // 1. Fetch Frankfurter API (USD to IDR) - REAL API
    let kursIDR = 16500;
    try {
      const res = await fetch(
        "https://api.frankfurter.app/latest?from=USD&to=IDR",
        { cache: 'no-store' }
      );
      if (res.ok) {
        const data = await res.json();
        if (data.rates && data.rates.IDR) {
          kursIDR = data.rates.IDR;
        }
      }
    } catch (e) {
      console.warn("Frankfurter API failed", e);
    }

    // 2. Fetch Open-Meteo API (Jakarta Weather proxy for national sentiment) - REAL API
    let isRaining = false;
    let temperature = 32;
    try {
      const res = await fetch(
        "https://api.open-meteo.com/v1/forecast?latitude=-6.2146&longitude=106.8451&current_weather=true",
      );
      if (res.ok) {
        const data = await res.json();
        if (data.current_weather) {
          temperature = data.current_weather.temperature;
          const code = data.current_weather.weathercode;
          if ((code >= 51 && code <= 65) || (code >= 80 && code <= 82)) {
            isRaining = true;
          }
        }
      }
    } catch (e) {
      console.warn("Weather API failed", e);
    }

    // 3. Global Commodity Simulation
    // Since free commodity APIs block Vercel or require auth, we simulate it seeded by the real weather/time.
    const currentMinute = new Date().getMinutes();
    const wheatIndex = 100 + (temperature - 30) * 2 + (currentMinute % 5); // Heatwaves increase wheat price
    const palmOilIndex = 100 + (isRaining ? 10 : -5) + (currentMinute % 7); // Rain disrupts harvest

    // 4. Fetch CoinGecko API (BTC to IDR) - REAL API
    let btcIdrPrice = 1142829537;
    try {
      const btcRes = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=idr', { cache: 'no-store' });
      if (btcRes.ok) {
        const btcData = await btcRes.json();
        if (btcData?.bitcoin?.idr) {
          btcIdrPrice = btcData.bitcoin.idr;
        }
      }
    } catch (e) {
      console.warn("CoinGecko API failed", e);
    }

    // 5. Fetch News RSS (CNBC Indonesia) - REAL API
    let newsHeadlines: string[] = [];
    try {
      const rssRes = await fetch('https://api.rss2json.com/v1/api.json?rss_url=https://www.cnbcindonesia.com/market/rss', { cache: 'no-store' });
      if (rssRes.ok) {
        const rssData = await rssRes.json();
        if (rssData?.items) {
          newsHeadlines = rssData.items.slice(0, 7).map((item: any) => item.title.toUpperCase());
        }
      }
    } catch (e) {
      console.warn("RSS API failed", e);
    }

    // 6. Data Normalization & Volatility
    const baseShrinkage = calculateShrinkage(kursIDR, wheatIndex);
    const minuteVolatility = ((currentMinute % 10) - 5) / 100;
    const sentimentModifier = isRaining ? 1.2 : temperature > 33 ? 0.9 : 1.0;

    // Calculate base inflation factor combining global macros
    const baseInflation =
      (kursIDR - 15000) / 15000 +
      (wheatIndex - 100) / 500 +
      (palmOilIndex - 100) / 500;

    // Baseline DKI Jakarta is the anchor (UMP ~ 5.72M) -> Base price ~ 2000
    const BASE_JAKARTA_PRICE = 2000;
    const JAKARTA_UMP = 5729876;

    const enrichedRegions = indonesiaUMP.map((region) => {
      // Local UMP ratio compared to Jakarta (affects purchasing power & pricing)
      const umpRatio = region.ump2026 / JAKARTA_UMP;

      const localVolatility = minuteVolatility * (Math.random() * 0.5 + 0.5);
      const inflationRate = baseInflation + localVolatility;

      // Calculate local price weighted by UMP (cheaper in low UMP regions, but floored at 500)
      const baseLocalPrice =
        BASE_JAKARTA_PRICE * Math.max(0.4, Math.pow(umpRatio, 0.7));

      const currentPrice = Math.round(
        baseLocalPrice * (1 + inflationRate) * sentimentModifier,
      );
      const sizePercentage = Math.round(baseShrinkage * (1 - localVolatility));

      let sentiment: "BULLISH" | "BEARISH" | "STAGNANT" = "STAGNANT";
      if (inflationRate > 0.02 || sentimentModifier > 1.1)
        sentiment = "BULLISH";
      else if (inflationRate < -0.01) sentiment = "BEARISH";

      // Disparity tweaks for specific items
      const tahuPrice = Math.round(currentPrice * 1.1); // Tahu slightly more expensive due to soy
      const tempePrice = Math.round(currentPrice * 0.9); // Tempe slightly cheaper

      return {
        region: region.name,
        ump: region.ump2026,
        bakwanPrice: currentPrice,
        tahuPrice: tahuPrice,
        tempePrice: tempePrice,
        chiliRatio: Number(Math.max(0, 3 - currentPrice / 1000).toFixed(1)), // Less chili when expensive
        sizePercentage,
        inflationRate,
        sentiment,
      };
    });

    // Sort regions by Bakwan price descending
    enrichedRegions.sort((a, b) => b.bakwanPrice - a.bakwanPrice);

    return NextResponse.json({
      timestamp: currentISOTime,
      macro: {
        kursIDR,
        isRaining,
        temperature,
        wheatIndex,
        palmOilIndex,
        btcIdrPrice,
        marketSentiment: isRaining
          ? "EXTREME_BULLISH"
          : temperature > 33
            ? "BEARISH"
            : "NEUTRAL",
      },
      regions: enrichedRegions,
      newsHeadlines,
      volatilityIndex: minuteVolatility,
    });
  } catch (error) {
    console.error("Engine error", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
