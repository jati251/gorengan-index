import { NextResponse } from "next/server";
import { calculateShrinkage } from "@/data/gorenganData";
import { fetchExternalMarketData } from "@/services/marketData";
import { PrismaClient } from "@prisma/client";
import { RegionalIndex } from "@/types";

const prisma = new PrismaClient();

// Revalidate every 10 seconds to cache parallel fetches and prevent API rate limiting
export const revalidate = 10;

export async function GET() {
  try {
    const { currentISOTime, newsHeadlines, macro } = await fetchExternalMarketData();
    const currentMinute = new Date().getMinutes();

    // 6. Data Normalization & Volatility
    const baseShrinkage = calculateShrinkage(macro.kursIDR, macro.wheatIndex);
    const minuteVolatility = ((currentMinute % 10) - 5) / 500; // Reduced minute volatility
    const sentimentModifier = macro.isRaining ? 1.02 : macro.temperature > 33 ? 0.98 : 1.0; // Reduced rain impact from 20% to 2%

    // Calculate base inflation factor combining global macros
    const baseInflation =
      (macro.kursIDR - 17808) / 17808 +
      (macro.wheatIndex - 613.25) / 613.25 +
      (macro.palmOilIndex - 65.94) / 65.94;

    const BASE_JAKARTA_PRICE = 2000;
    const JAKARTA_UMP = 5729876;

    // Fetch master data from Database (Prisma Postgres)
    const provinceData = await prisma.provinceData.findMany();

    const enrichedRegions: RegionalIndex[] = provinceData.map((region) => {
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
        region: region.region,
        ump: region.ump2026,
        bakwanPrice: currentPrice,
        tahuPrice: tahuPrice,
        tempePrice: tempePrice,
        chiliRatio: Number(Math.max(0, 3 - currentPrice / 1000).toFixed(1)), // Less chili when expensive
        sizePercentage,
        inflationRate,
        sentiment,
        population: region.population,
        gdpPerCapita: region.gdpPerCapita,
        dominantCommodity: region.dominantCommodity,
      };
    });

    // Sort regions by Bakwan price descending
    enrichedRegions.sort((a, b) => b.bakwanPrice - a.bakwanPrice);

    return NextResponse.json({
      timestamp: currentISOTime,
      macro: macro,
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
