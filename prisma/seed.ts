import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function generateData(startDate: Date, endDate: Date, startPrice: number, targetPrice: number, stepMs: number, timeframe: string, volatility: number) {
  const data = [];
  const totalDuration = endDate.getTime() - startDate.getTime();
  
  for (let t = startDate.getTime(); t <= endDate.getTime(); t += stepMs) {
    const progress = (t - startDate.getTime()) / totalDuration;
    // Linear trend from startPrice to targetPrice
    const trendedBase = startPrice + (targetPrice - startPrice) * progress;
    
    // Add noise
    const noise = trendedBase * (Math.random() * volatility - volatility / 2);
    const open = trendedBase + noise;
    
    const close = open + (open * (Math.random() * volatility - volatility / 2));
    const high = Math.max(open, close) + (open * Math.random() * (volatility / 2));
    const low = Math.min(open, close) - (open * Math.random() * (volatility / 2));
    const volume = Math.floor(Math.random() * 100000);

    data.push({
      timeframe,
      timestamp: new Date(t),
      open,
      high,
      low,
      close,
      volume,
    });
  }
  return data;
}

const milestones = [
  { year: 1980, price: 25 },
  { year: 1990, price: 100 },
  { year: 1998, price: 300 }, // Krismon spike start
  { year: 2001, price: 500 }, // Post krismon stabilized
  { year: 2010, price: 1000 },
  { year: 2020, price: 1500 },
  { year: 2023, price: 1800 },
  { year: 2026, price: 2000 }
];

function getAccurateHistoricalPrice(t: number): number {
  const currentYear = new Date(t).getFullYear() + (new Date(t).getMonth() / 12);
  
  if (currentYear <= milestones[0].year) return milestones[0].price;
  if (currentYear >= milestones[milestones.length - 1].year) return milestones[milestones.length - 1].price;

  for (let i = 0; i < milestones.length - 1; i++) {
    const m1 = milestones[i];
    const m2 = milestones[i + 1];
    if (currentYear >= m1.year && currentYear < m2.year) {
      const progress = (currentYear - m1.year) / (m2.year - m1.year);
      return m1.price + (m2.price - m1.price) * progress;
    }
  }
  return 2000;
}

function generateAccurateHistoryData(startDate: Date, endDate: Date, stepMs: number, timeframe: string, volatility: number) {
  const data = [];
  for (let t = startDate.getTime(); t <= endDate.getTime(); t += stepMs) {
    const trendedBase = getAccurateHistoricalPrice(t);
    
    const noise = trendedBase * (Math.random() * volatility - volatility / 2);
    const open = trendedBase + noise;
    
    const close = open + (open * (Math.random() * volatility - volatility / 2));
    const high = Math.max(open, close) + (open * Math.random() * (volatility / 2));
    const low = Math.min(open, close) - (open * Math.random() * (volatility / 2));
    const volume = Math.floor(Math.random() * 100000);

    data.push({ timeframe, timestamp: new Date(t), open, high, low, close, volume });
  }
  return data;
}

async function main() {
  console.log('Cleaning up old historical data...');
  await prisma.historicalData.deleteMany({});

  console.log('Generating 1M (Monthly) data since 1980...');
  const date1980 = new Date('1980-01-01T00:00:00Z');
  const now = new Date();
  
  const stepMonth = 30.44 * 24 * 60 * 60 * 1000;
  // Use Accurate Historical Data mapping
  const monthData = generateAccurateHistoryData(date1980, now, stepMonth, '1M', 0.15);
  console.log(`Inserting ${monthData.length} records for 1M...`);
  await prisma.historicalData.createMany({ data: monthData });

  console.log('Generating 1y (Yearly) data since 1980...');
  const stepYear = 365.25 * 24 * 60 * 60 * 1000;
  const yearData = generateAccurateHistoryData(date1980, now, stepYear, '1y', 0.15);
  console.log(`Inserting ${yearData.length} records for 1y...`);
  await prisma.historicalData.createMany({ data: yearData });

  console.log('Generating 1w (Weekly) data for the last 10 years...');
  const tenYearsAgo = new Date(now.getTime() - 10 * 365 * 24 * 60 * 60 * 1000);
  const stepWeek = 7 * 24 * 60 * 60 * 1000;
  // 10 years ago was 2016, price around 1000. Ends around 2000.
  const weekData = generateData(tenYearsAgo, now, 1000, 2000, stepWeek, '1w', 0.1);
  console.log(`Inserting ${weekData.length} records for 1w...`);
  for (let i = 0; i < weekData.length; i += 500) {
    await prisma.historicalData.createMany({ data: weekData.slice(i, i + 500) });
  }

  console.log('Generating 1D (Daily) data for the last 5 years...');
  const fiveYearsAgo = new Date(now.getTime() - 5 * 365 * 24 * 60 * 60 * 1000);
  const stepDay = 24 * 60 * 60 * 1000;
  // 5 years ago was 2021, price around 1000-1500. Ends around 2000.
  const dayData = generateData(fiveYearsAgo, now, 1200, 2000, stepDay, '1d', 0.05);
  console.log(`Inserting ${dayData.length} records for 1d...`);
  
  // Chunk insert to avoid large payload errors
  for (let i = 0; i < dayData.length; i += 500) {
    await prisma.historicalData.createMany({ data: dayData.slice(i, i + 500) });
  }

  console.log('Generating 5m (5-Minute) data for the last 10 days...');
  const tenDaysAgo = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);
  const step5Min = 5 * 60 * 1000;
  const currentDailyPrice = dayData[dayData.length - 1].close; // Sync with daily
  const minData = generateData(tenDaysAgo, now, currentDailyPrice, currentDailyPrice, step5Min, '5m', 0.005);
  console.log(`Inserting ${minData.length} records for 5m...`);
  
  for (let i = 0; i < minData.length; i += 1000) {
    await prisma.historicalData.createMany({ data: minData.slice(i, i + 1000) });
  }

  console.log('Database Seeding Completed Successfully! 🚀');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
