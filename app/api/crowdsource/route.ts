import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

// Prevent Prisma Client crashes if DB is not available yet
let prisma: PrismaClient | null = null;
try {
  prisma = new PrismaClient();
} catch (e) {
  console.warn("Prisma Client failed to initialize. Database might be unreachable.");
}

export async function POST(req: Request) {
  if (!prisma) {
    return NextResponse.json({ success: false, error: 'Database Not Configured' }, { status: 503 });
  }

  try {
    const body = await req.json();
    const { region, tipeGorengan, harga, shrinkflationDetected, kriukLevel } = body;

    const newPrice = await prisma.crowdsourcedPrice.create({
      data: {
        region,
        tipeGorengan,
        harga: Number(harga),
        shrinkflationDetected: Boolean(shrinkflationDetected),
        kriukLevel: Number(kriukLevel),
      },
    });

    return NextResponse.json({ success: true, data: newPrice });
  } catch (error) {
    console.error('Error submitting price:', error);
    return NextResponse.json({ success: false, error: 'Database Error' }, { status: 500 });
  }
}
