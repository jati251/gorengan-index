// Math utilities for calculation
export function calculateShrinkage(kursIDR: number, wheatIndex: number): number {
  // Shrinkage drops if IDR weakens or wheat price spikes
  const idrFactor = ((kursIDR - 15000) / 100);
  const wheatFactor = (wheatIndex - 100) / 2;
  return Math.max(30, 100 - idrFactor - wheatFactor);
}

export function calculateNetWorth(salary: number, bakwanPrice: number): number {
  if (bakwanPrice <= 0) return 0;
  return Math.floor(salary / bakwanPrice);
}

export function getSocialClass(netWorth: number): string {
  if (netWorth > 3000) return "Gorengan Whale / Konglomerat Tepung";
  if (netWorth >= 1000) return "Gorengan Middle Class / Aman dari Maag";
  return "Rentan Miskin Karbohidrat / Segera Cari Promosi";
}
