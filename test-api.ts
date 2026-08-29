import { PrismaClient } from '@prisma/client';
import { fetchExternalMarketData } from './services/marketData';

const prisma = new PrismaClient();

async function main() {
  console.log("Testing fetchExternalMarketData...");
  try {
    const extData = await fetchExternalMarketData();
    console.log("fetchExternalMarketData Success:", !!extData);
  } catch (e) {
    console.error("fetchExternalMarketData Error:", e);
  }

  console.log("Testing Prisma...");
  try {
    const data = await prisma.provinceData.findMany();
    console.log("Prisma Success, rows:", data.length);
  } catch (e) {
    console.error("Prisma Error:", e);
  }
}

main().catch(console.error);
