import mongoose from "mongoose";
import DailyPrice from "../models/DailyPrice.js";
import Ticker from "../models/Ticker.js";

type ServiceResult<T = unknown> = {
  message: string;
  data: T | null;
};

export const getTickerDailyPrices = async (
  tickerId: string,
  limit = 120
): Promise<ServiceResult> => {
  try {
    if (!mongoose.Types.ObjectId.isValid(tickerId)) {
      return { message: "Invalid ticker ID", data: null };
    }

    const ticker = await Ticker.findById(tickerId);
    if (!ticker) {
      return { message: "Ticker not found", data: null };
    }

    const cap = Math.min(Math.max(limit, 1), 365);
    const rows = await DailyPrice.find({ tickerId })
      .sort({ date: -1 })
      .limit(cap);

    const prices = rows
      .reverse()
      .map((p) => ({
        date: p.date,
        price: p.price,
        exchangeRate: p.exchangeRate ?? 1,
        priceINR: p.price * (p.exchangeRate ?? 1),
      }));

    return {
      message: "Daily prices fetched successfully",
      data: {
        ticker: {
          _id: ticker._id,
          name: ticker.name,
          tickerName: ticker.tickerName,
          currency: ticker.currency,
        },
        prices,
      },
    };
  } catch (error) {
    console.log("Error fetching daily prices:", error);
    return { message: "Failed to fetch daily prices", data: null };
  }
};
