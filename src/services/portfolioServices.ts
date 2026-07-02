import mongoose from "mongoose";
import PortfolioItem from "../models/PortfolioItem.js";
import Ticker from "../models/Ticker.js";
import Transaction from "../models/Transaction.js";
import { syncPortfolioFromTransactions } from "./syncServices.js";

type ServiceResult<T = any> = {
  message: string;
  data: T | null;
};

export const addPortfolioItem = async (
  userId: string,
  tickerId: string,
  buyingPrice: number,
  quantity: number,
  exchangeRate: number = 1
): Promise<ServiceResult> => {
  try {
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return { message: "Invalid user ID", data: null };
    }
    if (!mongoose.Types.ObjectId.isValid(tickerId)) {
      return { message: "Invalid ticker ID", data: null };
    }

    const ticker = await Ticker.findById(tickerId);
    if (!ticker) {
      return { message: "Ticker not found", data: null };
    }

    await Transaction.create({
      user: userId,
      ticker: tickerId,
      type: "BUY",
      date: new Date(),
      quantity,
      price: buyingPrice,
      exchangeRate,
    });

    await syncPortfolioFromTransactions(userId);

    const item = await PortfolioItem.findOne({ user: userId, ticker: tickerId });

    return { message: "Portfolio item added successfully", data: item };
  } catch (error) {
    console.log("Error adding portfolio item:", error);
    return { message: "Failed to add portfolio item", data: null };
  }
};

import DailyPrice from "../models/DailyPrice.js";

export const getUserPortfolio = async (userId: string): Promise<ServiceResult<any[]>> => {
  try {
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return { message: "Invalid user ID", data: null };
    }

    const items = await PortfolioItem.find({ user: userId })
      .populate("ticker")
      .sort({ createdAt: -1 });

    if (items.length === 0) {
      return { message: "No portfolio items found", data: [] };
    }

    // Merge portfolio items with latest prices from database
    const mergedItems = await Promise.all(
      items.map(async (item) => {
        const t = item.ticker as any;
        const latestPrice = await DailyPrice.findOne({ tickerId: t?._id }).sort({ date: -1 });
        
        return {
          ...item.toObject(),
          tickerDetails: t,
          currentPrice: latestPrice ? latestPrice.price : null,
          currentExchangeRate: latestPrice ? latestPrice.exchangeRate : 1,
          exchangeRate: item.exchangeRate || 1,
          priceError: latestPrice ? null : "No price data found in database",
          latestMetrics: latestPrice
            ? {
                trailingPE: latestPrice.trailingPE,
                forwardPE: latestPrice.forwardPE,
                epsTrailingTwelveMonths: latestPrice.epsTrailingTwelveMonths,
                epsForward: latestPrice.epsForward,
                priceToBook: latestPrice.priceToBook,
                marketCap: latestPrice.marketCap,
                dividendYield: latestPrice.dividendYield,
                trailingAnnualDividendYield: latestPrice.trailingAnnualDividendYield,
                fiftyDayAverage: latestPrice.fiftyDayAverage,
                twoHundredDayAverage: latestPrice.twoHundredDayAverage,
                fiftyTwoWeekHigh: latestPrice.fiftyTwoWeekHigh,
                fiftyTwoWeekLow: latestPrice.fiftyTwoWeekLow,
                regularMarketVolume: latestPrice.regularMarketVolume,
                averageDailyVolume3Month: latestPrice.averageDailyVolume3Month,
              }
            : null,
        };
      })
    );

    return { message: "Portfolio fetched successfully", data: mergedItems };
  } catch (error) {
    console.log("Error fetching user portfolio:", error);
    return { message: "Failed to fetch portfolio", data: null };
  }
};

export const updatePortfolioItem = async (
  itemId: string,
  buyingPrice: number,
  quantity: number,
  exchangeRate: number = 1
): Promise<ServiceResult> => {
  try {
    if (!mongoose.Types.ObjectId.isValid(itemId)) {
      return { message: "Invalid item ID", data: null };
    }

    const existingItem = await PortfolioItem.findById(itemId);
    if (!existingItem) {
      return { message: "Portfolio item not found", data: null };
    }

    const userId = existingItem.user.toString();
    const tickerId = existingItem.ticker.toString();

    // Wipe old transactions for this ticker to reset the state
    await Transaction.deleteMany({ user: userId, ticker: tickerId });

    // Create a new master BUY transaction reflecting the new state
    await Transaction.create({
      user: userId,
      ticker: tickerId,
      type: "BUY",
      date: new Date(),
      quantity,
      price: buyingPrice,
      exchangeRate,
    });

    // Re-sync which will recreate the PortfolioItem perfectly
    await syncPortfolioFromTransactions(userId);
    
    const item = await PortfolioItem.findOne({ user: userId, ticker: tickerId });

    return { message: "Portfolio item updated successfully", data: item };
  } catch (error) {
    console.log("Error updating portfolio item:", error);
    return { message: "Failed to update portfolio item", data: null };
  }
};

export const deletePortfolioItem = async (itemId: string): Promise<ServiceResult> => {
  try {
    if (!mongoose.Types.ObjectId.isValid(itemId)) {
      return { message: "Invalid item ID", data: null };
    }

    const existingItem = await PortfolioItem.findById(itemId);
    if (!existingItem) {
      return { message: "Portfolio item not found", data: null };
    }

    const userId = existingItem.user.toString();
    const tickerId = existingItem.ticker.toString();

    // Delete all transactions for this ticker
    await Transaction.deleteMany({ user: userId, ticker: tickerId });

    // Resync which will automatically delete the PortfolioItem
    await syncPortfolioFromTransactions(userId);

    return { message: "Portfolio item deleted successfully", data: null };
  } catch (error) {
    console.log("Error deleting portfolio item:", error);
    return { message: "Failed to delete portfolio item", data: null };
  }
};
