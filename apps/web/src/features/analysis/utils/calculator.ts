export function calculateTrade(capital: number, entry: number, exit: number, feePercent: number) {
  if (![capital, entry, exit, feePercent].every(Number.isFinite) || capital <= 0 || entry <= 0 || exit < 0 || feePercent < 0 || feePercent >= 100) return null;
  const fee = feePercent / 100;
  const quantity = capital / (entry * (1 + fee));
  const buyFee = quantity * entry * fee;
  const sellFee = quantity * exit * fee;
  const proceeds = quantity * exit - sellFee;
  const profit = proceeds - capital;
  const breakEven = capital / (quantity * (1 - fee));
  const result = { quantity, fees: buyFee + sellFee, proceeds, profit, roi: profit / capital * 100, breakEven };
  return Object.values(result).every(Number.isFinite) ? result : null;
}
