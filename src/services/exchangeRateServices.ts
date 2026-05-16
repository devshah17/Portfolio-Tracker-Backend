import DailyPrice from "../models/DailyPrice.js";
import Ticker from "../models/Ticker.js";

type ServiceResult<T = unknown> = {
  message: string;
  data: T | null;
};

/** Latest INR exchange rate per ticker from DailyPrice (for display / reference). */
export const getCurrentExchangeRates = async (): Promise<ServiceResult<unknown[]>> => {
  try {
    const tickers = await Ticker.find().sort({ createdAt: -1 });
    if (tickers.length === 0) {
      return { message: "No tickers found", data: [] };
    }

    const rates = await Promise.all(
      tickers.map(async (t) => {
        const latest = await DailyPrice.findOne({ tickerId: t._id }).sort({ date: -1 });
        return {
          tickerId: t._id,
          tickerName: t.tickerName,
          name: t.name,
          currency: t.currency,
          currentPrice: latest?.price ?? null,
          currentExchangeRate: latest?.exchangeRate ?? 1,
          asOf: latest?.date ?? null,
        };
      })
    );

    return { message: "Exchange rates fetched successfully", data: rates };
  } catch (error) {
    console.log("Error fetching exchange rates:", error);
    return { message: "Failed to fetch exchange rates", data: null };
  }
};
