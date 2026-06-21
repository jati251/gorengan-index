import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

let prisma: PrismaClient | null = null;
try {
  prisma = new PrismaClient();
} catch (e) {
  console.warn("Prisma Client failed to initialize in Chart API.");
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const timeframe = searchParams.get('timeframe') || '1d';

  if (!prisma) {
    // If DB is offline, return some dummy candlestick data so the UI doesn't crash
    const now = new Date();
    const dummyData = Array.from({ length: 50 }).map((_, i) => {
      const d = new Date(now.getTime() - (50 - i) * 24 * 60 * 60 * 1000);
      return {
        timestamp: d,
        open: 2000,
        high: 2100,
        low: 1900,
        close: 2050,
        volume: 1000
      };
    });
    return NextResponse.json({ success: true, data: dummyData });
  }

  try {
    const historical = await prisma.historicalData.findMany({
      where: { timeframe },
      orderBy: { timestamp: 'desc' }, // Get most recent first
      take: timeframe === '5m' ? 5000 : (timeframe === '1d' ? 2000 : (timeframe === '1w' ? 1000 : (timeframe === '1M' ? 1000 : 200)))
    });

    // Reverse to chronological order for the chart
    historical.reverse();

    return NextResponse.json({ success: true, data: historical });
  } catch (error) {
    console.error('Error fetching chart data:', error);
    return NextResponse.json({ success: false, error: 'Database Error' }, { status: 500 });
  }
}
