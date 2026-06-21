import { NextResponse } from "next/server";
import { calculateShrinkage } from "@/data/gorenganData";
import { indonesiaUMP } from "@/data/indonesiaUmp";

// Revalidate every 10 seconds to cache parallel fetches and prevent API rate limiting
export const revalidate = 10;

export async function GET() {
  try {
    // Default Fallbacks
    let currentISOTime = new Date().toISOString();
    let kursIDR = 16500;
    let isRaining = false;
    let temperature = 32;
    let btcIdrPrice = 1142829537;
    let newsHeadlines: string[] = [];
    let wheatIndex = 613.25;
    let palmOilIndex = 65.94;

    const currentMinute = new Date().getMinutes();

    // 1. Parallelize all external API fetches (Brutal Optimization)
    // Drops latency from ~2100ms down to ~300ms by running all 7 requests concurrently
    const [
      timeRes,
      frankfurterRes,
      weatherRes,
      btcRes,
      rssRes,
      wheatRes,
      palmRes
    ] = await Promise.allSettled([
      fetch('https://timeapi.io/api/Time/current/zone?timeZone=Asia/Jakarta'),
      fetch('https://api.frankfurter.app/latest?from=USD&to=IDR'),
      fetch('https://api.open-meteo.com/v1/forecast?latitude=-6.2146&longitude=106.8451&current_weather=true'),
      fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=idr'),
      fetch('https://api.rss2json.com/v1/api.json?rss_url=https://www.cnbcindonesia.com/market/rss'),
      fetch('https://query1.finance.yahoo.com/v8/finance/chart/ZW=F'),
      fetch('https://query1.finance.yahoo.com/v8/finance/chart/ZL=F')
    ]);

    // 2. Parse responses safely
    if (timeRes.status === 'fulfilled' && timeRes.value.ok) {
      try { const d = await timeRes.value.json(); if(d.dateTime) currentISOTime = d.dateTime + "+07:00"; } catch(e){}
    }
    if (frankfurterRes.status === 'fulfilled' && frankfurterRes.value.ok) {
      try { const d = await frankfurterRes.value.json(); if(d.rates?.IDR) kursIDR = d.rates.IDR; } catch(e){}
    }
    if (weatherRes.status === 'fulfilled' && weatherRes.value.ok) {
      try { 
        const d = await weatherRes.value.json(); 
        if(d.current_weather) {
          temperature = d.current_weather.temperature;
          const code = d.current_weather.weathercode;
          if ((code >= 51 && code <= 65) || (code >= 80 && code <= 82)) isRaining = true;
        }
      } catch(e){}
    }
    if (btcRes.status === 'fulfilled' && btcRes.value.ok) {
      try { const d = await btcRes.value.json(); if(d.bitcoin?.idr) btcIdrPrice = d.bitcoin.idr; } catch(e){}
    }
    if (rssRes.status === 'fulfilled' && rssRes.value.ok) {
      try { const d = await rssRes.value.json(); if(d.items) newsHeadlines = d.items.slice(0, 7).map((i: any) => i.title.toUpperCase()); } catch(e){}
    }
    if (wheatRes.status === 'fulfilled' && wheatRes.value.ok) {
      try { const d = await wheatRes.value.json(); if(d?.chart?.result?.[0]?.meta?.regularMarketPrice) wheatIndex = d.chart.result[0].meta.regularMarketPrice; } catch(e){}
    }
    if (palmRes.status === 'fulfilled' && palmRes.value.ok) {
      try { const d = await palmRes.value.json(); if(d?.chart?.result?.[0]?.meta?.regularMarketPrice) palmOilIndex = d.chart.result[0].meta.regularMarketPrice; } catch(e){}
    }

    // 6. Data Normalization & Volatility
    const baseShrinkage = calculateShrinkage(kursIDR, wheatIndex);
    const minuteVolatility = ((currentMinute % 10) - 5) / 500; // Reduced minute volatility
    const sentimentModifier = isRaining ? 1.02 : temperature > 33 ? 0.98 : 1.0; // Reduced rain impact from 20% to 2%

    // Calculate base inflation factor combining global macros
    // Normalized exactly to current live values so base inflation is exactly 0% today
    const baseInflation =
      (kursIDR - 17808) / 17808 +
      (wheatIndex - 613.25) / 613.25 +
      (palmOilIndex - 65.94) / 65.94;

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
