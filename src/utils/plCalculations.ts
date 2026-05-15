/**
 * Unrealised P&L (aligned with /dashboard/portfolios):
 * - Cost in INR: buyingPrice × buyingExchangeRate × quantity
 * - Value in INR: currentPrice × buyingExchangeRate × quantity
 * Gain isolates native price movement; FX is locked at the purchase rate.
 */
export function investmentINR(
  buyingPrice: number,
  buyingRate: number,
  quantity: number
): number {
  const rate = buyingRate || 1;
  return buyingPrice * rate * quantity;
}

export function currentValueINR(
  currentPrice: number | null | undefined,
  buyingPrice: number,
  buyingRate: number,
  quantity: number
): number {
  const rate = buyingRate || 1;
  const price = currentPrice ?? buyingPrice;
  return price * rate * quantity;
}

export function unrealisedPL(
  buyingPrice: number,
  buyingRate: number,
  currentPrice: number | null | undefined,
  quantity: number
): number {
  return (
    currentValueINR(currentPrice, buyingPrice, buyingRate, quantity) -
    investmentINR(buyingPrice, buyingRate, quantity)
  );
}

/** Price-only % change in native currency (FX-neutral). */
export function unrealisedPLPercent(
  buyingPrice: number,
  currentPrice: number | null | undefined
): number {
  if (!currentPrice || buyingPrice <= 0) return 0;
  return ((currentPrice - buyingPrice) / buyingPrice) * 100;
}

export function buildLatestPriceMaps(
  latestPrices: { tickerId: { toString(): string }; price: number; exchangeRate?: number }[]
): { priceMap: Record<string, number>; rateMap: Record<string, number> } {
  const priceMap: Record<string, number> = {};
  const rateMap: Record<string, number> = {};
  for (const p of latestPrices) {
    const tid = p.tickerId.toString();
    if (!priceMap[tid]) {
      priceMap[tid] = p.price;
      rateMap[tid] = p.exchangeRate || 1;
    }
  }
  return { priceMap, rateMap };
}
