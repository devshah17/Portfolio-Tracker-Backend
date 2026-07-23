import PortfolioItem from "../models/PortfolioItem.js";
import PortfolioGroup from "../models/PortfolioGroup.js";
import PortfolioEntry from "../models/PortfolioEntry.js";
import DailyPrice from "../models/DailyPrice.js";
import Transaction from "../models/Transaction.js";
import YahooFinance from "yahoo-finance2";
const yahooFinance = new YahooFinance();
import {
  buildLatestPriceMaps,
  currentValueINR,
  investmentINR,
  unrealisedPLPercent,
} from "../utils/plCalculations.js";

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
  const sectorAllocation: Record<string, { value: number, companies: any[] }> = {};
  let totalSectorValue = 0;

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

    if (ticker.type === "Stock") {
      const sector = ticker.sector || "Uncategorized";
      if (!sectorAllocation[sector]) {
        sectorAllocation[sector] = { value: 0, companies: [] };
      }
      sectorAllocation[sector].value += curINR;
      
      const existingCompany = sectorAllocation[sector].companies.find(c => c.tickerName === ticker.tickerName);
      if (existingCompany) {
        existingCompany.value += curINR;
        existingCompany.invested += buyINR;
        existingCompany.gains += (curINR - buyINR);
      } else {
        sectorAllocation[sector].companies.push({
          name: ticker.name,
          tickerName: ticker.tickerName,
          value: curINR,
          invested: buyINR,
          gains: (curINR - buyINR)
        });
      }
      totalSectorValue += curINR;
    }

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

  // 7. Market Benchmarks
  let benchmarks: any[] = [];
  try {
    const quotes = await yahooFinance.quote(['^GSPC', '^IXIC', '^NSEI', 'BTC-USD']);
    benchmarks = quotes.map((q: any) => ({
      symbol: q.symbol,
      name: q.shortName || q.longName || q.symbol,
      price: q.regularMarketPrice,
      change: q.regularMarketChangePercent
    }));
  } catch (error) {
    console.error("Error fetching market benchmarks:", error);
  }

  // 8. Risk Metrics (Beta & Max Drawdown)
  let portfolioBeta = 1.0;
  let maxDrawdown = 0;
  let volatilityProfile = "Medium";

  try {
    const uniqueTickers = [...new Set(validAssets.map(a => (a.ticker as any).tickerName))];
    
    // Fetch summaryDetail for all unique tickers concurrently
    const summaryResults = await Promise.all(
      uniqueTickers.map(t => yahooFinance.quoteSummary(t, { modules: ['summaryDetail'] }).catch(() => null))
    );

    let totalWeightForBeta = 0;
    let weightedBetaSum = 0;

    let totalWeightForDrawdown = 0;
    let weightedDrawdownSum = 0;

    assetsWithData.forEach(asset => {
      const tickerName = asset.name;
      const summaryIdx = uniqueTickers.indexOf(tickerName);
      const summary = summaryIdx !== -1 ? summaryResults[summaryIdx]?.summaryDetail : null;

      if (summary) {
        // Beta calculation
        if (summary.beta !== undefined && summary.beta !== null) {
          weightedBetaSum += summary.beta * asset.value;
          totalWeightForBeta += asset.value;
        }

        // Drawdown calculation: (52W High - 52W Low) / 52W High
        if (summary.fiftyTwoWeekHigh && summary.fiftyTwoWeekLow && summary.fiftyTwoWeekHigh > 0) {
          const drawdown = (summary.fiftyTwoWeekHigh - summary.fiftyTwoWeekLow) / summary.fiftyTwoWeekHigh;
          weightedDrawdownSum += drawdown * asset.value;
          totalWeightForDrawdown += asset.value;
        }
      }
    });

    if (totalWeightForBeta > 0) {
      portfolioBeta = weightedBetaSum / totalWeightForBeta;
    }
    
    if (totalWeightForDrawdown > 0) {
      maxDrawdown = (weightedDrawdownSum / totalWeightForDrawdown) * 100; // as percentage
    }

    if (portfolioBeta > 1.2) {
      volatilityProfile = "High";
    } else if (portfolioBeta < 0.8) {
      volatilityProfile = "Low";
    }
  } catch (error) {
    console.error("Error calculating risk metrics:", error);
  }

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
    sectorAllocation: Object.entries(sectorAllocation).map(([name, data]) => ({
      name,
      value: data.value,
      percent: totalSectorValue > 0 ? (data.value / totalSectorValue) * 100 : 0,
      companies: data.companies.sort((a, b) => b.value - a.value)
    })).sort((a, b) => b.value - a.value),
    groups: groupHighlights,
    movers,
    benchmarks,
    riskMetrics: {
      portfolioBeta,
      maxDrawdown,
      volatilityProfile
    }
  };
};

export const getHistoricalPerformance = async (userId: string, periodDays: number = 365) => {
  const period1 = new Date();
  period1.setDate(period1.getDate() - periodDays);

  // 1. Fetch all transactions for this user up to today
  const transactions = await Transaction.find({ user: userId, date: { $lte: new Date() } }).populate("ticker");
  
  // Sort transactions by date ascending
  transactions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const validTransactions = transactions.filter(t => t.ticker && (t.ticker as any).tickerName);
  
  console.log(`Fetched ${transactions.length} transactions, valid: ${validTransactions.length}`);

  // Get all unique symbols the user has ever transacted
  const symbols = [...new Set(validTransactions.map(t => (t.ticker as any).tickerName))];
  const symbolCurrencies: Record<string, string> = {};
  validTransactions.forEach(t => {
    const sym = (t.ticker as any).tickerName;
    symbolCurrencies[sym] = (t.ticker as any).currency || 'INR';
  });

  console.log('Symbols:', symbols);
  
  const benchmarkSymbols = ['^NSEI', '^GSPC', 'BTC-USD'];

  const fetchHistorical = async (sym: string) => {
    try {
      return await yahooFinance.historical(sym, { period1, period2: new Date(), interval: '1d' });
    } catch (e) {
      console.error(`Error fetching historical for ${sym}:`, e);
      return [];
    }
  };

  const assetResults = await Promise.all(symbols.map(fetchHistorical));
  const benchmarkResults = await Promise.all(benchmarkSymbols.map(fetchHistorical));

  const allDates = new Set<string>();
  const assetPrices: Record<string, Record<string, number>> = {};
  const benchmarkValues: Record<string, Record<string, number>> = {};
  const currencyPrices: Record<string, Record<string, number>> = {};

  // Fetch exchange rates for any non-INR currencies
  const uniqueCurrencies = [...new Set(Object.values(symbolCurrencies))].filter(c => c !== 'INR');
  const fetchCurrency = async (curr: string) => {
    try {
      const res = await yahooFinance.chart(`${curr}INR=X`, { period1, period2: new Date(), interval: '1d' });
      return res.quotes || [];
    } catch (e) {
      console.error(`Error fetching historical currency for ${curr}INR=X:`, e);
      return [];
    }
  };
  const currencyResults = await Promise.all(uniqueCurrencies.map(fetchCurrency));

  uniqueCurrencies.forEach((curr, idx) => {
    currencyPrices[curr] = {};
    const history = currencyResults[idx] || [];
    history.forEach((day: any) => {
      if (day.date && day.close !== null) {
        const dateStr = new Date(day.date).toISOString().split('T')[0];
        allDates.add(dateStr);
        currencyPrices[curr][dateStr] = day.close;
      }
    });
  });

  symbols.forEach((sym, idx) => {
    assetPrices[sym] = {};
    const history = assetResults[idx] || [];
    history.forEach((day: any) => {
      const dateStr = new Date(day.date).toISOString().split('T')[0];
      allDates.add(dateStr);
      assetPrices[sym][dateStr] = day.close || 0;
    });
  });

  benchmarkSymbols.forEach((sym, idx) => {
    benchmarkValues[sym] = {};
    const history = benchmarkResults[idx] || [];
    history.forEach((day: any) => {
      const dateStr = new Date(day.date).toISOString().split('T')[0];
      allDates.add(dateStr);
      benchmarkValues[sym][dateStr] = day.close || 0;
    });
  });

  const sortedDates = Array.from(allDates).sort();

  // Initialize balances BEFORE period1
  const balances: Record<string, number> = {};
  const invested: Record<string, number> = {};
  symbols.forEach(s => {
    balances[s] = 0;
    invested[s] = 0;
  });

  let tIdx = 0;

  // Process any transactions that occurred BEFORE the first available price date
  if (sortedDates.length > 0) {
    const firstDate = sortedDates[0];
    while (tIdx < validTransactions.length) {
      const t = validTransactions[tIdx];
      const tDateStr = new Date(t.date).toISOString().split('T')[0];
      if (tDateStr < firstDate) {
        const sym = (t.ticker as any).tickerName;
        const exchangeRate = t.exchangeRate || 1;
        const value = t.quantity * t.price * exchangeRate;
        if (t.type === 'BUY') {
          invested[sym] += value;
          balances[sym] += t.quantity;
        } else if (t.type === 'SELL') {
          if (balances[sym] > 0) {
            const avgCost = invested[sym] / balances[sym];
            invested[sym] = Math.max(0, invested[sym] - (t.quantity * avgCost));
          }
          balances[sym] = Math.max(0, balances[sym] - t.quantity);
        }
        tIdx++;
      } else {
        break;
      }
    }
  }

  const result = [];
  const prevAssetPrice: Record<string, number> = {};
  const prevCurrencyPrice: Record<string, number> = {};
  const prevBenchmarks: Record<string, number> = {};
  benchmarkSymbols.forEach(b => prevBenchmarks[b] = 0);
  uniqueCurrencies.forEach(c => prevCurrencyPrice[c] = 1); // fallback

  for (let i = 0; i < sortedDates.length; i++) {
    const d = sortedDates[i];
    
    // Process transactions that happened on or before this date
    while (tIdx < validTransactions.length) {
      const t = validTransactions[tIdx];
      const tDateStr = new Date(t.date).toISOString().split('T')[0];
      if (tDateStr <= d) {
        const sym = (t.ticker as any).tickerName;
        const exchangeRate = t.exchangeRate || 1;
        const value = t.quantity * t.price * exchangeRate;
        if (t.type === 'BUY') {
          invested[sym] += value;
          balances[sym] += t.quantity;
        } else if (t.type === 'SELL') {
          if (balances[sym] > 0) {
            const avgCost = invested[sym] / balances[sym];
            invested[sym] = Math.max(0, invested[sym] - (t.quantity * avgCost));
          }
          balances[sym] = Math.max(0, balances[sym] - t.quantity);
        }
        tIdx++;
      } else {
        break;
      }
    }

    let dailyPortfolioValue = 0;
    let dailyInvested = 0;
    
    // Update trailing currency prices for this day
    uniqueCurrencies.forEach(curr => {
      if (currencyPrices[curr] && currencyPrices[curr][d] !== undefined) {
        prevCurrencyPrice[curr] = currencyPrices[curr][d];
      }
    });

    symbols.forEach(sym => {
       if (assetPrices[sym] && assetPrices[sym][d] !== undefined) prevAssetPrice[sym] = assetPrices[sym][d];
       
       let rawPrice = prevAssetPrice[sym] || 0;
       const curr = symbolCurrencies[sym];
       if (curr !== 'INR') {
         rawPrice *= (prevCurrencyPrice[curr] || 1);
       }

       dailyPortfolioValue += rawPrice * balances[sym];
       dailyInvested += invested[sym] || 0;
    });
    
    const dayData: any = { 
      date: d, 
      portfolioValue: dailyPortfolioValue,
      totalInvested: dailyInvested,
      totalGains: dailyPortfolioValue - dailyInvested
    };
    
    benchmarkSymbols.forEach(b => {
      if (benchmarkValues[b][d] !== undefined) prevBenchmarks[b] = benchmarkValues[b][d];
      dayData[b] = prevBenchmarks[b];
    });
    result.push(dayData);
  }

  // Optional: filter out leading days where the portfolio value was exactly 0
  let firstNonZeroIdx = 0;
  while (firstNonZeroIdx < result.length && result[firstNonZeroIdx].portfolioValue === 0) {
    firstNonZeroIdx++;
  }

  const finalResult = result.slice(firstNonZeroIdx);

  // Calculate percentages based on the baseline (first available non-zero day)
  if (finalResult.length > 0) {
    const baseline = finalResult[0];
    const basePortVal = baseline.portfolioValue || 1;
    
    const baseBmk: Record<string, number> = {};
    benchmarkSymbols.forEach(b => {
      baseBmk[b] = baseline[b] || 1;
    });

    finalResult.forEach(day => {
      day.portfolioPct = ((day.portfolioValue - basePortVal) / basePortVal) * 100;
      benchmarkSymbols.forEach(b => {
        day[`${b}_pct`] = ((day[b] - baseBmk[b]) / baseBmk[b]) * 100;
      });
    });
  }

  return finalResult;
};
