import axios from "axios";
import Ticker from "../models/Ticker.js";
import DailyPrice from "../models/DailyPrice.js";

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
          },
          { upsert: true, returnDocument: "after" },
        );
        console.log(`CRON: Updated price for ${t.tickerName}: ${pData.price}`);
      } else {
        console.log(`CRON: Could not fetch price for ${t.tickerName}`);
      }
    }
    console.log("CRON: Ticker price update completed successfully.");
  } catch (error: any) {
    console.error("CRON: Error updating ticker prices:", error.message);
    if (error.response) {
      console.error("CRON: Response data:", error.response.data);
    }
  }
};
