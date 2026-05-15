import PortfolioItem from "../models/PortfolioItem";
import PortfolioGroup from "../models/PortfolioGroup";
import PortfolioEntry from "../models/PortfolioEntry";
import DailyPrice from "../models/DailyPrice";
import {
  buildLatestPriceMaps,
  currentValueINR,
  investmentINR,
  unrealisedPLPercent,
} from "../utils/plCalculations";

export const getDashboardStats = async (userId: string) => {
  // 1. Get all assets for the user
  const assets = await PortfolioItem.find({ user: userId }).populate("ticker");

  // 2. Get all portfolio groups for the user
  const groups = await PortfolioGroup.find({ user: userId });

  // 3. Get latest prices/rates for all relevant tickers
  const validAssets = assets.filter(a => a.ticker && (a.ticker as any)._id);
  const tickerIds = validAssets.map(a => (a.ticker as any)._id);
  
  const latestPrices = tickerIds.length > 0 
    ? await DailyPrice.find({ tickerId: { $in: tickerIds } }).sort({ date: -1 })
    : [];

  const { priceMap } = buildLatestPriceMaps(latestPrices);

  // 4. Calculate Global Stats (same formula as /dashboard/portfolios)
  let totalInvestment = 0;
  let currentValue = 0;
  const typeAllocation: Record<string, number> = {};
  const marketAllocation: Record<string, number> = {};

  const assetsWithData = assets.map(asset => {
    const ticker: any = asset.ticker;
    const tid = ticker._id.toString();
    const buyingRate = asset.exchangeRate || 1;
    const currentPrice = priceMap[tid] ?? asset.buyingPrice;

    const buyINR = investmentINR(asset.buyingPrice, buyingRate, asset.quantity);
    const curINR = currentValueINR(
      priceMap[tid] ?? null,
      asset.buyingPrice,
      buyingRate,
      asset.quantity
    );

    totalInvestment += buyINR;
    currentValue += curINR;

    const type = ticker.type || "Other";
    typeAllocation[type] = (typeAllocation[type] || 0) + curINR;

    const market = ticker.market || "Other";
    marketAllocation[market] = (marketAllocation[market] || 0) + curINR;

    return {
      name: ticker.tickerName,
      type: ticker.type,
      value: curINR,
      perf: unrealisedPLPercent(asset.buyingPrice, currentPrice),
    };
  });

  // 5. Portfolio Groups Highlights (Query junction table)
  const groupHighlights = await Promise.all(groups.map(async g => {
    const count = await PortfolioEntry.countDocuments({ portfolioGroup: g._id });
    return {
      _id: g._id,
      name: g.name,
      itemCount: count
    };
  }));

  // 6. Top Movers
  const movers = [...assetsWithData]
    .sort((a, b) => Math.abs(b.perf) - Math.abs(a.perf))
    .slice(0, 5);

  return {
    summary: {
      totalInvestment,
      currentValue,
      totalPL: currentValue - totalInvestment,
      plPct: totalInvestment > 0 ? ((currentValue - totalInvestment) / totalInvestment) * 100 : 0
    },
    allocation: Object.entries(typeAllocation).map(([name, value]) => ({
      name,
      value,
      percent: currentValue > 0 ? ((value as number) / currentValue) * 100 : 0
    })).sort((a, b) => (b.value as number) - (a.value as number)),
    marketAllocation: Object.entries(marketAllocation).map(([name, value]) => ({
      name,
      value,
      percent: currentValue > 0 ? ((value as number) / currentValue) * 100 : 0
    })).sort((a, b) => (b.value as number) - (a.value as number)),
    groups: groupHighlights,
    movers
  };
};
