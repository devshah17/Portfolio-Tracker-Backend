import axios from "axios";
import Ticker from "../models/Ticker.js";
import DailyPrice from "../models/DailyPrice.js";
import YahooFinance from "yahoo-finance2";

const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

export const updateTickerPrices = async () => {
  console.log("CRON: Starting ticker price update...");
  try {
    const tickers = await Ticker.find();
    if (tickers.length === 0) {
      console.log("CRON: No tickers found in database.");
      return;
    }

    const payload = tickers.map((t) => ({
      ticker: t.tickerName,
      currency: t.currency,
      market: t.market,
    }));

    const CHUNK_SIZE = 50;
    let priceData: any[] = [];

    for (let i = 0; i < payload.length; i += CHUNK_SIZE) {
      const chunk = payload.slice(i, i + CHUNK_SIZE);
      const response = await axios.post(
        `${process.env.API_BASE_URL}/api/tickers`,
        {
          tickers: chunk,
        },
      );
      priceData = priceData.concat(response.data?.data || []);
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const t of tickers) {
      const pData = priceData.find((p: any) => p.ticker === t.tickerName);
      if (pData && pData.price !== undefined) {
        // Upsert daily price record: match on tickerId and normalized date
        await DailyPrice.findOneAndUpdate(
          { tickerId: t._id, date: today },
          {
            tickerId: t._id,
            price: pData.price,
            exchangeRate: pData.exchangeRate || 1,
            date: today,
            trailingPE: pData.trailingPE,
            forwardPE: pData.forwardPE,
            epsTrailingTwelveMonths: pData.epsTrailingTwelveMonths,
            epsForward: pData.epsForward,
            priceToBook: pData.priceToBook,
            marketCap: pData.marketCap,
            dividendYield: pData.dividendYield,
            trailingAnnualDividendYield: pData.trailingAnnualDividendYield,
            fiftyDayAverage: pData.fiftyDayAverage,
            twoHundredDayAverage: pData.twoHundredDayAverage,
            fiftyTwoWeekHigh: pData.fiftyTwoWeekHigh,
            fiftyTwoWeekLow: pData.fiftyTwoWeekLow,
            regularMarketVolume: pData.regularMarketVolume,
            averageDailyVolume3Month: pData.averageDailyVolume3Month,
            averageAnalystRating: pData.averageAnalystRating,
          },
          { upsert: true, returnDocument: "after" },
        );
        console.log(`CRON: Updated price for ${t.tickerName}: ${pData.price}`);
      } else {
        console.log(`CRON: Could not fetch price for ${t.tickerName}`);
      }
    }

    // Update Ticker profiles (Sector, Industry, Related Companies)
    for (const t of tickers) {
      try {
        let updated = false;

        // Fetch sector/industry only if missing
        if (!t.sector) {
          const qsResult = await yahooFinance.quoteSummary(t.tickerName, { modules: ['assetProfile'] }).catch(() => null);
          if (qsResult?.assetProfile) {
            t.sector = qsResult.assetProfile.sector;
            t.industry = qsResult.assetProfile.industry;
            updated = true;
          }
        }

        // Always fetch and update related companies
        const recResult = await yahooFinance.recommendationsBySymbol(t.tickerName).catch(() => null);
        if (recResult?.recommendedSymbols) {
          t.relatedCompanies = recResult.recommendedSymbols.map((r: any) => r.symbol);
          updated = true;
        }

        if (updated) {
          await t.save();
          console.log(`CRON: Updated profile/related for ${t.tickerName}`);
        }
      } catch (e) {
        console.log(`CRON: Error saving profile for ${t.tickerName}`);
      }
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Clear records older than 1 year
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    
    const deleteResult = await DailyPrice.deleteMany({
      date: { $lt: oneYearAgo },
    });
    console.log(`CRON: Cleaned up ${deleteResult.deletedCount} old price records.`);

    console.log("CRON: Ticker price update completed successfully.");
  } catch (error: any) {
    console.error("CRON: Error updating ticker prices:", error.message);
    if (error.response) {
      console.error("CRON: Response data:", error.response.data);
    }
  }
};
